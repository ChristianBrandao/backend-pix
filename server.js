// Importa as dependências necessárias
const express = require('express');
const mercadopago = require('mercadopago'); // Importa o pacote inteiro
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações para o servidor
app.use(bodyParser.json());
app.use(cors());

// Configura o SDK do Mercado Pago
// SUBSTITUA PELA SUA CHAVE REAL DE ACESSO!
const client = new mercadopago.MercadoPagoConfig({
    accessToken: 'APP_USR-8046348863440985-080101-ec5f3acae31f13e30ee83c06ddbedf23-242546340'
});

// Endpoint para gerar a cobrança Pix
app.post('/api/create-pix-payment', async (req, res) => {
    try {
        const { quantity, amount } = req.body;
        
        const paymentData = {
            transaction_amount: Number(amount),
            description: `Números da Sorte Pix - ${quantity} unidades`,
            payment_method_id: 'pix',
            payer: {
                email: 'christiancrmj16@gmail.com'
            },
            notification_url: `https://seusite.com/api/pix-webhook`
        };

        const paymentClient = new mercadopago.Payments(client); // Acessando a classe do objeto importado
        const payment = await paymentClient.create({ body: paymentData });

        const pix_code = payment.point_of_interaction.transaction_data.qr_code;
        const qr_code_base64 = payment.point_of_interaction.transaction_data.qr_code_base64;

        res.status(200).json({ 
            pix_code: pix_code,
            qr_code: `data:image/jpeg;base64,${qr_code_base64}`
        });

    } catch (error) {
        console.error('Erro ao criar Pix:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Endpoint para receber as notificações de pagamento (webhooks)
app.post('/api/pix-webhook', async (req, res) => {
    const paymentInfo = req.body;
    console.log('Webhook de pagamento recebido:', paymentInfo);

    try {
        if (paymentInfo.type === 'payment' && paymentInfo.data.status === 'approved') {
            const paymentId = paymentInfo.data.id;
            console.log(`Pagamento #${paymentId} aprovado e processado.`);
        }
    } catch (error) {
        console.error('Erro ao processar webhook:', error);
    }
    
    res.status(200).send('OK');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});