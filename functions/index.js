const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Payment } = require("mercadopago");

admin.initializeApp();

const FIREBASE_PROJECT_ID_GLOBAL = process.env.GCLOUD_PROJECT;

/**
 * Calcula a divisão do valor dos produtos, frete e taxa de serviço entre os fornecedores.
 * ESTA FUNÇÃO AINDA É CHAMADA, MAS SEU RESULTADO NÃO SERÁ USADO NO PAYLOAD DO MP POR ENQUANTO.
 * @param {Array<Object>} carrinho - Lista de itens no carrinho.
 * @param {number} frete - Valor do frete.
 * @param {number} taxaServico - Valor da taxa de serviço.
 * @returns {Promise<Array<Object>>} - Um array de objetos de split para o Mercado Pago.
 * @throws {functions.https.HttpsError} Se um fornecedor não for encontrado ou não tiver mercadoPagoId.
 */
const calcularSplit = async (carrinho, frete, taxaServico) => {
    const splitPorFornecedor = {};
    const db = admin.firestore();

    functions.logger.info("Iniciando cálculo de split.");
    if (!carrinho || carrinho.length === 0) {
        functions.logger.warn("Carrinho vazio ou inválido para cálculo de split. Retornando array vazio.");
        return [];
    }

    carrinho.forEach((item) => {
        const fornecedorNome = item.fornecedor || "Desconhecido";
        const valorItem = parseFloat((item.preco * item.quantidade).toFixed(2));

        if (!splitPorFornecedor[fornecedorNome]) {
            splitPorFornecedor[fornecedorNome] = {
                valorProdutos: 0,
                qtdItens: 0,
                nomeFornecedor: fornecedorNome
            };
        }
        // Correção aqui: garantir que splitPorFornecedor[fornecedorNome] é usado corretamente
        splitPorFornecedor[fornecedorNome].valorProdutos += valorItem;
        splitPorFornecedor[fornecedorNome].qtdItens += item.quantidade;
    });

    const numFornecedores = Object.keys(splitPorFornecedor).length;
    if (numFornecedores === 0) {
        functions.logger.warn("Nenhum fornecedor válido encontrado no carrinho após processamento. Retornando array vazio.");
        return [];
    }

    // Distribuir frete e taxa de serviço proporcionalmente ou igualmente
    const fretePorFornecedor = parseFloat((frete / numFornecedores).toFixed(2));
    const taxaPorFornecedor = parseFloat((taxaServico / numFornecedores).toFixed(2));

    functions.logger.info(`Número de fornecedores para split: ${numFornecedores}`);
    functions.logger.info(`Frete por fornecedor: ${fretePorFornecedor}, Taxa de Serviço por fornecedor: ${taxaPorFornecedor}`);

    const splitPromises = Object.values(splitPorFornecedor).map(async (dadosFornecedor) => {
        functions.logger.info(`Buscando fornecedor '${dadosFornecedor.nomeFornecedor}' no Firestore.`);
        const fornecedorSnapshot = await db.collection("fornecedores")
            .where("empresa", "==", dadosFornecedor.nomeFornecedor)
            .limit(1)
            .get();

        if (fornecedorSnapshot.empty) {
            functions.logger.error(`Fornecedor '${dadosFornecedor.nomeFornecedor}' não encontrado no Firestore.`);
            throw new functions.https.HttpsError(
                "failed-precondition",
                `Fornecedor '${dadosFornecedor.nomeFornecedor}' não encontrado no Firestore ou sem ID do Mercado Pago configurado. Verifique o campo 'empresa' no Firestore.`,
                { fornecedorNome: dadosFornecedor.nomeFornecedor }
            );
        }

        const fornecedorData = fornecedorSnapshot.docs[0].data();
        const idMercadoPagoDoFornecedor = fornecedorData.mercadoPagoId;
        functions.logger.info(`ID Mercado Pago para '${dadosFornecedor.nomeFornecedor}': ${idMercadoPagoDoFornecedor}`);

        if (!idMercadoPagoDoFornecedor) {
             functions.logger.error(`Fornecedor '${dadosFornecedor.nomeFornecedor}' encontrado, mas sem 'mercadoPagoId'.`);
             throw new functions.https.HttpsError(
                "failed-precondition",
                `Fornecedor '${dadosFornecedor.nomeFornecedor}' encontrado, mas não tem o campo 'mercadoPagoId' configurado.`,
                { fornecedorNome: dadosFornecedor.nomeFornecedor }
            );
        }

        const amountForSupplier = parseFloat((dadosFornecedor.valorProdutos + fretePorFornecedor + taxaPorFornecedor).toFixed(2));
        functions.logger.info(`Valor para fornecedor '${dadosFornecedor.nomeFornecedor}': ${amountForSupplier}`);

        return {
            id: idMercadoPagoDoFornecedor,
            amount: amountForSupplier,
            release_delay: 604800, // 7 dias
            fee_payer: "collector", // O recebedor paga a taxa
        };
    });

    const results = await Promise.all(splitPromises);
    functions.logger.info("Cálculo de split concluído com sucesso.", { splitResults: results });
    return results;
};


// Cloud Function para criar o PIX no Mercado Pago (HTTP Request)
exports.criarPixHortifruti = functions.https.onRequest(async (req, res) => {
    functions.logger.info("--- Início da Chamada HTTP para criarPixHortifruti (Nova Versão 2.8 - Resposta Frontend Fix) ---"); // IDENTIFICADOR DE VERSÃO

    // Configurar cabeçalhos CORS para lidar com requisições de diferentes origens
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600'); // Cache preflight requests for 1 hour

    // Lidar com requisições OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
        functions.logger.info('Requisição OPTIONS (preflight CORS) recebida. Enviando cabeçalhos CORS e resposta 204.');
        res.status(204).send('');
        return;
    }

    let decodedToken;
    let authUid = 'UID indisponível';
    let authEmail = 'Email do token indisponível';
    let authName = 'Nome do token indisponível';

    try {
        let idToken = null;

        // Tentar obter o token do cabeçalho Authorization primeiro (abordagem preferencial)
        const authorizationHeader = req.headers.authorization;
        functions.logger.info(`DEBUG: Valor do cabeçalho Authorization: ${authorizationHeader || 'Não presente'}`);

        if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
            idToken = authorizationHeader.split('Bearer ')[1];
            functions.logger.info(`DEBUG: Token extraído do cabeçalho Authorization (primeiros 10 chars): ${idToken.substring(0, 10)}...`);
        } else {
            functions.logger.warn("DEBUG: Cabeçalho Authorization ausente ou inválido. Verificando body.data.idToken como fallback.");
            // Fallback: tentar obter o token do corpo da requisição, se ainda estiver sendo enviado lá
            if (req.body && req.body.data && req.body.data.idToken) {
                idToken = req.body.data.idToken;
                functions.logger.info(`DEBUG: Token encontrado em body.data.idToken (primeiros 10 chars): ${idToken.substring(0, 10)}...`);
            } else {
                functions.logger.error("ERRO: Token de autenticação não encontrado em nenhum local esperado (Authorization header ou body.data.idToken).");
                res.status(401).send("Não autorizado: Token de autenticação ausente ou inválido.");
                return;
            }
        }

        if (!idToken) {
            functions.logger.error("ERRO CRÍTICO: idToken é nulo após todas as tentativas de extração.");
            res.status(401).send("Não autorizado: Token de autenticação é nulo.");
            return;
        }

        // Verificar o token usando admin.auth()
        decodedToken = await admin.auth().verifyIdToken(idToken);
        authUid = decodedToken.uid;
        authEmail = decodedToken.email;
        authName = decodedToken.name || authEmail.split('@')[0];

        functions.logger.info("Token de autenticação verificado com sucesso.", { uid: authUid, email: authEmail });
    } catch (tokenError) {
        functions.logger.error("Erro na verificação do token de autenticação (detalhes):", tokenError.message || tokenError, { stack: tokenError.stack });
        res.status(401).send(`Não autorizado: Token de autenticação inválido ou expirado. Detalhes: ${tokenError.message || 'Erro desconhecido.'}`);
        return;
    }

    // Acessa o objeto 'data' dentro do corpo da requisição.
    // Para funções HTTP, o corpo pode ser diretamente a payload JSON ou encapsulado em `data`.
    // Priorizamos `req.body.data` se existir, caso contrário, `req.body`.
    let requestData = req.body;
    if (req.body && req.body.data) {
        requestData = req.body.data;
    }

    functions.logger.info("Verificando 'requestData' recebido.");
    if (!requestData) {
        functions.logger.error("ERRO: O corpo da requisição está vazio ou não contém dados válidos.");
        res.status(400).send("Dados inválidos: O corpo da requisição deve conter dados.");
        return;
    }
    functions.logger.info("Conteúdo completo do 'requestData' (ou body.data) recebido:", requestData);

    // Desestruturação dos dados da requisição.
    // O idToken não é mais esperado no requestData para autenticação principal.
    const { carrinho, frete, taxaServico, total, nomeCliente, external_reference } = requestData;

    // --- BLOCO DE VALIDAÇÃO COM LOGS DETALHADOS ---
    let validationErrors = [];

    functions.logger.info(`Validando carrinho. Tamanho: ${carrinho ? carrinho.length : 'N/A'}`);
    if (!carrinho || !Array.isArray(carrinho) || carrinho.length === 0) {
        validationErrors.push("carrinho está faltando, não é um array ou está vazio");
    } else {
        carrinho.forEach((item, index) => {
            if (!item.nome || typeof item.nome !== 'string') validationErrors.push(`item[${index}].nome está faltando ou não é string`);
            if (typeof item.preco === 'undefined' || item.preco === null || isNaN(item.preco)) validationErrors.push(`item[${index}].preco está faltando, nulo ou não é número`);
            if (typeof item.quantidade === 'undefined' || item.quantidade === null || isNaN(item.quantidade) || item.quantidade <= 0) validationErrors.push(`item[${index}].quantidade está faltando, nulo, não é número ou é <= 0`);
        });
    }

    functions.logger.info(`Validando frete: ${frete}`);
    if (typeof frete === 'undefined' || frete === null || isNaN(frete) || typeof frete !== 'number') {
        validationErrors.push("frete está faltando, nulo ou não é um número válido");
    }

    functions.logger.info(`Validando taxaServico: ${taxaServico}`);
    if (typeof taxaServico === 'undefined' || taxaServico === null || isNaN(taxaServico) || typeof taxaServico !== 'number') {
        validationErrors.push("taxaServico está faltando, nulo ou não é um número válido");
    }

    functions.logger.info(`Validando total: ${total}`);
    if (typeof total === 'undefined' || total === null || isNaN(total) || typeof total !== 'number') {
        validationErrors.push("total está faltando, nulo ou não é um número válido");
    }

    functions.logger.info(`Validando nomeCliente: ${nomeCliente}`);
    if (!nomeCliente || typeof nomeCliente !== 'string' || nomeCliente.trim() === "") {
        validationErrors.push("nomeCliente está faltando, vazio ou não é string");
    }

    functions.logger.info(`Validando external_reference: ${external_reference}`);
    if (!external_reference || typeof external_reference !== 'string' || external_reference.trim() === "") {
        validationErrors.push("external_reference está faltando, vazio ou não é string");
    }

    if (validationErrors.length > 0) {
        functions.logger.error("ERRO DE VALIDAÇÃO: Dados incompletos ou inválidos para criar o PIX.", {
            dataRecebida: requestData,
            errosDeValidacao: validationErrors
        });
        res.status(400).send("Dados incompletos ou inválidos para criar o PIX. Detalhes: " + validationErrors.join(", "));
        return;
    }


    // A função calcularSplit AINDA É CHAMADA para fins de teste e debug, mas seu resultado não será usado no payload do MP.
    let splitConfig;
    try {
        splitConfig = await calcularSplit(carrinho, frete, taxaServico);
        if (splitConfig.length > 0) { // Log para saber se splitConfig seria gerado
            functions.logger.info("calcularSplit gerou splitConfig, mas não será incluído no payload do MP neste teste.");
        } else {
            functions.logger.warn("calcularSplit retornou vazio.");
        }
    } catch (splitError) {
        functions.logger.error("Erro ao calcular split na função principal (apenas para debug, não impacta o fluxo do MP neste teste):", splitError.message || splitError, { stack: splitError.stack });
    }


    try {
        let MERCADOPAGO_ACCESS_TOKEN_LOCAL;
        let mpClient;
        let mpPayment;
        
        try {
            MERCADOPAGO_ACCESS_TOKEN_LOCAL = process.env.MERCADOPAGO_ACCESS_TOKEN;

            if (!MERCADOPAGO_ACCESS_TOKEN_LOCAL || typeof MERCADOPAGO_ACCESS_TOKEN_LOCAL !== 'string' || MERCADOPAGO_ACCESS_TOKEN_LOCAL.trim() === "") {
                functions.logger.error("ERRO: MERCADOPAGO_ACCESS_TOKEN não configurado ou inválido durante a invocação da função criarPixHortifruti.");
                res.status(500).send("Configuração de pagamento interna ausente. Contate o suporte ou configure o token.");
                return;
            }
            
            mpClient = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN_LOCAL, options: { timeout: 5000 } });
            mpPayment = new Payment(mpClient);
            functions.logger.info("Mercado Pago client inicializado com sucesso (usando process.env).");

        } catch (e) {
            functions.logger.error("Erro ao inicializar Mercado Pago:", e.message || e, { stack: e.stack });
            res.status(500).send(`Falha ao processar pagamento (MP Init). Detalhes: ${e.message || 'Erro desconhecido.'}`);
            return;
        }

        const paymentPayload = {
            transaction_amount: parseFloat(total),
            payment_method_id: "pix",
            payer: {
                email: authEmail, // Usando o email do token verificado
                first_name: nomeCliente.split(" ")[0],
                // Adicionando detalhes de identificação para PIX (necessário para testes com split_rules)
                identification: {
                    type: "CPF",
                    number: "46480361822" // SEU CPF DE TESTE VÁLIDO (sem pontos e traços)
                }
            },
            description: "Compra no Hortifruti Digital (Teste Sem Split)", // Descrição para este teste
            notification_url: `https://us-central1-${FIREBASE_PROJECT_ID_GLOBAL}.cloudfunctions.net/notificacaoPix`,
            external_reference: external_reference,
            installments: 1, 
            binary_mode: false,
            // SPLIT_RULES REMOVIDAS PARA ESTE TESTE DE DEBUG
            // items: itemsParaMercadoPago, // Items já removidos na versão anterior
        };
        functions.logger.info("FINAL Payload enviado para Mercado Pago (DEBUG - Sem Split):", JSON.stringify(paymentPayload, null, 2));

        const response = await mpPayment.create({ body: paymentPayload }); 
        functions.logger.info("Resposta do Mercado Pago recebida com sucesso.", { paymentId: response.id, status: response.status });

        const db = admin.firestore();
        // Correção para 'splitPorNfornecedor' em calcularSplit se ainda existir
        // No momento, o calcularSplit não está impactando diretamente, mas a correção é boa prática.
        if (typeof splitPorFornecedor !== 'undefined' && typeof splitPorFornecedor.valorProdutos !== 'undefined') {
             // Esta linha estava com um erro de digitação `splitPorNfornecedor`
             // e o acesso a `valorProdutos` não era correto ali.
             // O erro de "splitPorNfornecedor is not defined" não ocorreu porque a função calcularSplit
             // ainda não está no fluxo crítico do try/catch para o MP, mas é bom corrigir.
             // Se o objetivo é apenas retornar, não há necessidade de acessar `valorProdutos` aqui.
             // Removendo a correção para manter o código da função calcularSplit como está,
             // o erro era na linha `splitPorNfornecedor[fornecedorNome].valorProdutos += valorItem;`
             // que já foi corrigida no código final para `splitPorFornecedor[fornecedorNome].valorProdutos += valorItem;`.
             // Portanto, não há mudança relevante aqui no `criarPixHortifruti`.
        }


        await db.collection("pedidos").doc(external_reference).update({
            paymentId: response.id,
            status: response.status,
            qrCode: response.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
            mercadoPagoResponse: response,
            emailClientePagamento: response.payer?.email,
            nomeClientePagamento: response.payer?.first_name,
        });
        functions.logger.info(`Pedido ${external_reference} atualizado no Firestore com dados do PIX.`);

        // --- CORREÇÃO AQUI: ENVOLVER A RESPOSTA EM UM OBJETO 'data' ---
        res.status(200).json({
            data: { // Adicionado o campo 'data' aqui!
                qrCode: response.point_of_interaction?.transaction_data?.qr_code,
                qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
                paymentId: response.id,
                status: response.status,
            }
        });
        functions.logger.info("--- Fim da Chamada HTTP para criarPixHortifruti (Sucesso) ---");
        return;

    } catch (error) {
        functions.logger.error("Erro ao chamar API do Mercado Pago para PIX:", error.message || error, {
            stack: error.stack,
            mpStatus: error.status,
            mpCause: error.cause,
            mpResponseData: error.response?.data
        });

        let errorMessage = "Erro ao gerar PIX. Por favor, tente novamente mais tarde.";
        if (error.cause && Array.isArray(error.cause) && error.cause.length > 0) {
            errorMessage += " Detalhes: " + error.cause.map(c => c.description || c.code).join(", ");
        } else if (error.message) {
            errorMessage += " Detalhes: " + error.message;
        }

        // Se for um erro do Mercado Pago relacionado a split_rules, dê uma mensagem mais específica
        if (error.message && error.message.includes("split_rules.receiver_id: must be a collector")) {
            errorMessage = "Erro no pagamento: O fornecedor não está configurado corretamente como recebedor no Mercado Pago. Por favor, verifique a configuração da conta do fornecedor.";
        } else if (error.response?.data?.message) {
            errorMessage = `Erro do Mercado Pago: ${error.response.data.message}`;
        }
        
        res.status(500).send(errorMessage);
        functions.logger.info("--- Fim da Chamada HTTP para criarPixHortifruti (Erro) ---");
        return;
    }
});


exports.notificacaoPix = functions.https.onRequest(async (req, res) => {
    functions.logger.info("--- Início do Webhook de notificação PIX recebido (Nova Versão 1.2 - Final Webhook Fix) ---"); // IDENTIFICADOR DE VERSÃO

    // Configurar cabeçalhos CORS (para o caso de testes manuais, webhooks em produção não precisam)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    let MERCADOPAGO_ACCESS_TOKEN_LOCAL;
    let mpClient;
    let mpPayment;
    
    try {
        MERCADOPAGO_ACCESS_TOKEN_LOCAL = process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!MERCADOPAGO_ACCESS_TOKEN_LOCAL || typeof MERCADOPAGO_ACCESS_TOKEN_LOCAL !== 'string' || MERCADOPAGO_ACCESS_TOKEN_LOCAL.trim() === "") {
            functions.logger.error("ERRO: MERCADOPAGO_ACCESS_TOKEN não configurado ou inválido durante a invocação do webhook de notificação.");
            return res.status(500).send("Internal server error: Payment gateway not configured for webhook.");
        }
        
        mpClient = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN_LOCAL, options: { timeout: 5000 } });
        mpPayment = new Payment(mpClient);
        functions.logger.info("Mercado Pago client inicializado com sucesso para webhook (usando process.env).");

    } catch (e) {
        functions.logger.error("Erro ao inicializar Mercado Pago no webhook:", e.message || e, { stack: e.stack });
        return res.status(500).send("Internal server error during webhook processing.");
    }

    const payment_id = req.body?.data?.id || req.body?.id || req.query?.id;
    functions.logger.info(`Webhook: ID de pagamento recebido: ${payment_id}`);

    if (!payment_id) {
        functions.logger.warn("ID de pagamento ausente na notificação do webhook. Resposta 400.", { body: req.body, query: req.query });
        return res.status(400).send("ID de pagamento ausente");
    }

    // Responda OK rapidamente para o webhook do Mercado Pago para evitar retries.
    // O processamento restante pode continuar assincronamente.
    res.status(200).send("OK");
    functions.logger.info(`Webhook: Resposta 200 OK enviada para Mercado Pago para ID ${payment_id}. Processamento em segundo plano.`);


    try {
        const db = admin.firestore();

        functions.logger.info(`Webhook: Buscando detalhes do pagamento ${payment_id} no Mercado Pago.`);
        const paymentDetails = await mpPayment.get({ id: payment_id });
        functions.logger.info("Webhook: Detalhes do pagamento obtidos com sucesso do Mercado Pago.", { details: paymentDetails });


        const status = paymentDetails.status;
        const externalReferenceFromPayment = paymentDetails.external_reference; 

        if (!externalReferenceFromPayment) {
            functions.logger.warn(`Webhook: externalReferenceFromPayment não encontrado para payment_id ${payment_id}. Não é possível vincular ao pedido do Firestore.`);
            return; 
        }

        const updateData = {
            status: status,
            statusAtualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
            // Garante que valorPagoMercadoPago nunca seja undefined. Usa 0 se for undefined/null.
            valorPagoMercadoPago: paymentDetails.transaction_amount_received ?? 0, 
            meioPagamentoDetalhes: {
                id: paymentDetails.payment_method_id,
                type: paymentDetails.payment_type_id,
                installments: paymentDetails.installments ?? 0, // installments também pode ser undefined para PIX
            },
        };

        if (status === 'approved') {
            updateData.dataAprovacao = admin.firestore.FieldValue.serverTimestamp();
            functions.logger.info(`Webhook: Pagamento ${payment_id} APROVADO. Atualizando dataAprovacao.`);
        }

        const pedidoRef = db.collection("pedidos").doc(externalReferenceFromPayment);
        await pedidoRef.update(updateData); // Agora updateData não terá undefined

        functions.logger.info(`Webhook: Pedido ${externalReferenceFromPayment} atualizado no Firestore com status: ${status}.`); 
    } catch (error) {
        functions.logger.error("Erro no processamento assíncrono do webhook (após resposta 200 OK):", error.message || error, {
            stack: error.stack,
            mpStatus: error.status,
            mpCause: error.cause,
            mpResponseData: error.response?.data
        });
    } finally {
        functions.logger.info("--- Fim do Webhook de notificação PIX (Processamento Concluído) ---");
    }
});
