const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações para o servidor
app.use(bodyParser.json());
app.use(cors());

// Configurações do Banco de Dados MySQL
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

// Configura o SDK do Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// Endpoint para gerar a cobrança Pix
app.post('/api/create-pix-payment', async (req, res) => {
    let connection;
    try {
        const { quantity, amount, email } = req.body;
        
        connection = await mysql.createConnection(dbConfig);

        const paymentData = {
            transaction_amount: Number(amount),
            description: `Números da Sorte Pix - ${quantity} unidades`,
            payment_method_id: 'pix',
            payer: { email: email },
            notification_url: `${process.env.PUBLIC_URL}/api/pix-webhook`
        };

        const paymentClient = new Payment(client);
        const payment = await paymentClient.create({ body: paymentData });
        
        // Insere a transação no banco de dados com status 'pending'
        await connection.execute(
            'INSERT INTO payments (payment_id, status, transaction_amount, email, quantity) VALUES (?, ?, ?, ?, ?)',
            [payment.id, 'pending', amount, email, quantity]
        );

        const pix_code = payment.point_of_interaction.transaction_data.qr_code;
        const qr_code_base64 = payment.point_of_interaction.transaction_data.qr_code_base64;

        res.status(200).json({ 
            pix_code: pix_code,
            qr_code: `data:image/jpeg;base64,${qr_code_base64}`,
            paymentId: payment.id
        });

    } catch (error) {
        console.error('Erro ao criar Pix:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        if (connection) connection.end();
    }
});

// Endpoint para verificar o status do pagamento
app.get('/api/check-payment-status/:paymentId', async (req, res) => {
    let connection;
    try {
        const { paymentId } = req.params;
        connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.execute(
            'SELECT status FROM payments WHERE payment_id = ?',
            [paymentId]
        );

        if (rows.length > 0) {
            res.status(200).json({ status: rows[0].status });
        } else {
            res.status(404).json({ error: 'Pagamento não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        if (connection) connection.end();
    }
});

// Endpoint para receber as notificações de pagamento (webhooks)
app.post('/api/pix-webhook', async (req, res) => {
    const paymentInfo = req.body;
    let connection;

    try {
        if (paymentInfo.type === 'payment' && paymentInfo.data.status === 'approved') {
            const paymentId = paymentInfo.data.id;
            connection = await mysql.createConnection(dbConfig);

            const [paymentRows] = await connection.execute(
                'SELECT quantity, email FROM payments WHERE payment_id = ? AND status = ?',
                [paymentId, 'pending']
            );

            if (paymentRows.length > 0) {
                const { quantity, email } = paymentRows[0];
                
                await connection.execute(
                    'UPDATE payments SET status = ? WHERE payment_id = ?',
                    ['approved', paymentId]
                );

                console.log(`Pagamento #${paymentId} aprovado. Gerando ${quantity} números para ${email}.`);
                
                const numerosGerados = [];
                for (let i = 0; i < quantity; i++) {
                    const numero = Math.floor(Math.random() * 100000);
                    numerosGerados.push(numero);
                    await connection.execute(
                        'INSERT INTO numbers (payment_id, number) VALUES (?, ?)',
                        [paymentId, numero]
                    );
                }
                
                console.log('Números gerados e salvos:', numerosGerados);
            }
        }
    } catch (error) {
        console.error('Erro ao processar webhook:', error);
    } finally {
        if (connection) connection.end();
    }
    
    res.status(200).send('OK');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});
