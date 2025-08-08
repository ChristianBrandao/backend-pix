// Importa as dependências necessárias
const express = require('express');
const { MercadoPagoConfig, InPersonPayments } = require('mercadopago'); // CORREÇÃO: Usar a classe de pagamentos presenciais
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações para o servidor
app.use(bodyParser.json());
app.use(cors());

// Configura o SDK do Mercado Pago
// IMPORTANTE: Use variáveis de ambiente para a chave de acesso em um ambiente real.
const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-8046348863440985-080101-ec5f3acae31f13e30ee83c06ddbedf23-242546340'
});

// Endpoint para gerar a cobrança Pix
app.post('/api/create-pix-payment', async (req, res) => {
    try {
        const { quantity, amount } = req.body;
        
        const orderData = {
            external_id: `order-pix-${Date.now()}`,
            title: `Números da Sorte Pix`,
            description: `${quantity} unidades`,
            total_amount: Number(amount),
            items: [
                {
                    sku_number: '1',
                    category: 'luck_numbers',
                    title: `Números da Sorte`,
                    description: `Compra de ${quantity} números`,
                    unit_price: Number(amount),
                    quantity: 1,
                    unit_measure: 'unit'
                }
            ],
            expiration_date: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        };

        // Usa a classe InPersonPayments para criar a ordem
        const inPersonPaymentsClient = new InPersonPayments(client);
        const order = await inPersonPaymentsClient.createOrder({ body: orderData });

        const pix_code = order.qr.qr_code;
        const qr_code_base64 = order.qr.qr_code_base64;

        res.status(200).json({
            pix_code: pix_code,
            qr_code: `data:image/jpeg;base64,${qr_code_base64}`,
            paymentId: order.id
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