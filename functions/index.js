
const functions = require("firebase-functions");
const admin = require("firebase-admin");

const axios = require("axios");

admin.initializeApp();

// --- CORREÇÃO IMPORTANTE AQUI: TORNAR calcularSplit ASSÍNCRONA E BUSCAR O ID ---
// Função para calcular o split (adaptada para o backend)
// Agora é uma função assíncrona porque vai consultar o Firestore
const calcularSplit = async (carrinho, frete, taxaServico) => {
    const splitPorFornecedor = {};

    // 1. Calcular valor dos produtos por fornecedor
    carrinho.forEach((item) => {
        const fornecedor = item.nomeFornecedor || "Desconhecido";
        const valorItem = item.preco * item.quantidade;

        if (!splitPorFornecedor[fornecedor]) {
            splitPorFornecedor[fornecedor] = {
                valorProdutos: 0,
                qtdItens: 0,
                nomeFornecedor: fornecedor // Adicione o nome do fornecedor aqui
            };
        }
        splitPorFornecedor[fornecedor].valorProdutos += valorItem;
        splitPorFornecedor[fornecedor].qtdItens += item.quantidade;
    });

    // 2. Distribuir frete e taxa proporcionalmente
    const numFornecedores = Object.keys(splitPorFornecedor).length;
    // Evitar divisão por zero se não houver fornecedores
    const fretePorFornecedor = numFornecedores > 0 ? frete / numFornecedores : 0;
    const taxaPorFornecedor = numFornecedores > 0 ? taxaServico / numFornecedores : 0;

    // 3. Mapear para o formato do Mercado Pago e buscar o ID no Firestore
    const splitPromises = Object.values(splitPorFornecedor).map(async (dadosFornecedor) => {
        // --- BUSCA O ID DO MERCADO PAGO NO FIRESTORE ---
        const fornecedorDoc = await admin.firestore().collection("fornecedores")
            .where("nome", "==", dadosFornecedor.nomeFornecedor)
            .limit(1)
            .get();

        if (fornecedorDoc.empty) {
            // Se o fornecedor não for encontrado no DB, isso é um erro.
            // Decida como tratar: pular este fornecedor, lançar um erro, etc.
            // Para depuração, vou lançar um erro.
            throw new Error(`Fornecedor '${dadosFornecedor.nomeFornecedor}' não encontrado no Firestore.`);
        }

        const idMercadoPagoDoFornecedor = fornecedorDoc.docs[0].data().mercadoPagoId; // Certifique-se que seu campo é 'idMercadoPago'

        return {
            id: idMercadoPagoDoFornecedor,
            amount: (dadosFornecedor.valorProdutos + fretePorFornecedor + taxaPorFornecedor).toFixed(2),
            fee_payer: "collector",
        };
    });

    // Aguardar todas as buscas de ID de fornecedor
    return Promise.all(splitPromises);
};


// Cloud Function para criar o PIX
exports.criarPixHortifruti = functions.https.onCall(async (data, context) => {
    // 1. Verifica autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não logado!");
    }

    // --- CORREÇÃO IMPORTANTE AQUI: USAR await PARA calcularSplit ---
    // 2. Calcula o split (agora é uma função assíncrona)
    const splitConfig = await calcularSplit( // AGORA PRECISA DO AWAIT AQUI
        data.carrinho,
        data.frete,
        data.taxaServico
    );
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log("Usuário autenticado:", user.uid);
            // Só permitir chamadas aqui
          } else {
            console.log("Usuário não logado");
          }
        });
      
        return () => unsubscribe();
      }, []);
      if (!auth.currentUser) {
        Alert.alert("Erro", "Você precisa estar logado para fazer o pedido.");
        return;
      }
    // Verifique se o splitConfig está vazio (se nenhum fornecedor foi encontrado)
    if (splitConfig.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", "Nenhum fornecedor válido encontrado para o split.");
    }

    // 3. Chama a API do Mercado Pago
    try {
        const response = await axios.post(
            "https://api.mercadopago.com/v1/payments",
            {
                transaction_amount: data.total,
                payment_method_id: "pix",
                payer: {
                    email: context.auth.token.email,
                    first_name: data.nomeCliente.split(" ")[0],
                },
                description: "Pedido Hortifruti Digital",
                notification_url: "https://us-central1-pi5semestre-b6926.cloudfunctions.net/notificacaoPix",
                external_reference: `pedido_${Date.now()}_${context.auth.uid}`,
                split: splitConfig,
            },
            {
                headers: {
                    Authorization: `Bearer ${functions.config().mercadopago.token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        // 4. Salva o pedido no Firestore
        await admin.firestore().collection("pedidos").add({
            userId: context.auth.uid,
            paymentId: response.data.id,
            status: "pending",
            qrCode: response.data.point_of_interaction?.transaction_data?.qr_code,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            qrCode: response.data.point_of_interaction?.transaction_data?.qr_code,
            paymentId: response.data.id,
        };
    } catch (error) {
        console.error("Erro no PIX:", error.response?.data || error.message);
        throw new functions.https.HttpsError(
            "internal",
            "Erro ao gerar PIX",
            error.response?.data
        );
    }
});

// Função para receber notificações do Mercado Pago (Webhook)
exports.notificacaoPix = functions.https.onRequest(async (req, res) => {
    // CORREÇÃO: Formato da notificação do Mercado Pago pode variar.
    // O mais comum para eventos de pagamento é { "action": "payment.created", "data": { "id": "PAYMENT_ID" } }
    // ou diretamente { "id": "PAYMENT_ID" } se for IPN legacy.
    const payment_id = req.body?.data?.id || req.body?.id || req.query?.id;

    if (!payment_id) {
        console.warn("ID de pagamento ausente na notificação:", req.body); // Logar o body completo para depuração
        return res.status(400).send("ID de pagamento ausente");
    }

    try {
        const payment = await axios.get(
            `https://api.mercadopago.com/v1/payments/${payment_id}`,
            {
                headers: {
                    Authorization: `Bearer ${functions.config().mercadopago.token}`,
                },
            }
        );

        const status = payment.data.status;
        const pedidoRef = admin.firestore().collection("pedidos").where("paymentId", "==", payment_id);

        const snapshot = await pedidoRef.get();

        // Mapear updates e usar Promise.all para garantir que todos os updates terminem
        const updates = snapshot.docs.map((doc) =>
            doc.ref.update({ status })
        );
        await Promise.all(updates);

        res.status(200).send("OK");
    } catch (error) {
        console.error("Erro na notificação:", error.response?.data || error.message);
        // Retornar um 500 para o Mercado Pago, para que ele possa tentar novamente
        res.status(500).send("Erro interno no webhook");
    }
});