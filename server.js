
const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer'); // <--- PANGGIL PAK POS EMAIL REAL
const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ==================== KONFIGURASI PAK POS (NODEMAILER) ====================
// PENTING: Isikan data Gmail lo di bawah ini agar server bisa ngirim email asli!
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'srjcompeny@gmail.com',  // <-- Ganti pakai Gmail lo sendiri
        pass: 'ojfd dfgx vwau hymd'       // <-- Ganti pakai 16 digit "Sandi Aplikasi / App Password" Google lo
    }
});

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. API DAFTAR (REGISTER) -> SEKARANG DENGAN KIRIM EMAIL ASLI KESIMPAN
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    const db = readDB();

    // Cek apakah email atau username sudah ada di database
    const userExists = db.users.find(u => u.email === email || u.username === username);
    if (userExists) {
        return res.status(400).json({ success: false, message: 'Username atau Email sudah dipakai, Bro!' });
    }

    const vCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = {
        id: Date.now(),
        username,
        email,       // <-- Data email pendaftar disimpan utuh ke database JSON
        password,
        avatar: '',
        isVerified: false,
        verificationCode: vCode,
        balance: 0,
        transactions: []
    };

    // Settingan amplop surat yang mau dikirim
    const mailOptions = {
        from: '"Eclipse Torii Network" <EMAIL_UTAMA_LO@gmail.com>', // Nama Toko lo
        to: email, // <--- INI DIA! Email tujuan otomatis mengambil email si pengguna yang baru daftar!
        subject: '🔒 KODE VERIFIKASI STASIUN ECLIPSE TORII LO!',
        html: `
            <div style="font-family: sans-serif; padding: 30px; background-color: #050209; color: #ffffff; border-radius: 12px; text-align: center; border: 1px solid #3b0764;">
                <h1 style="color: #a855f7; margin-bottom: 5px; font-size: 24px;">ECLIPSE TORII</h1>
                <p style="color: #94a3b8; font-size: 14px;">Cyber Security Verification System</p>
                <hr style="border-color: #2e1065; margin: 20px 0;">
                <p style="font-size: 15px;">Halo <b>${username}</b>, sistem mendeteksi registrasi akun baru menggunakan email ini.</p>
                <p style="color: #cbd5e1;">Gunakan kode enkripsi di bawah ini untuk mengaktifkan akun lo:</p>
                <div style="background-color: #0f0717; padding: 15px; display: inline-block; font-size: 28px; font-weight: bold; color: #ef4444; border: 1px solid #a855f7; border-radius: 8px; letter-spacing: 6px; margin: 15px 0; width: 200px;">
                    ${vCode}
                </div>
                <p style="font-size: 11px; color: #64748b; margin-top: 15px;">Abaikan email ini jika lo tidak merasa mendaftar di web Eclipse Torii.</p>
            </div>
        `
    };

    try {
        // Eksekusi pengiriman email ke tujuan asli via internet
        await transporter.sendMail(mailOptions);
        
        // Jika pos terkirim tanpa error, simpan data ke database local
        db.users.push(newUser);
        writeDB(db);
        
        res.json({ success: true, message: `Registrasi sukses! Kode OTP asli sudah meluncur langsung ke email: ${email}`, email });
    } catch (error) {
        console.error('Error pos email:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim surat kode OTP asli. Periksa konfigurasi App Password server lo!' });
    }
});

// 2. API LOGIN
app.post('/api/login', (req, res) => {
    const { emailOrUsername, password } = req.body;
    const db = readDB();

    const user = db.users.find(u => 
        (u.email === emailOrUsername || u.username === emailOrUsername) && u.password === password
    );

    if (!user) return res.status(400).json({ success: false, message: 'Akun gak ketemu atau password salah!' });
    if (user.balance === undefined) user.balance = 0;
    if (!user.transactions) user.transactions = [];

    res.json({ success: true, user });
});

// 3. API VERIFIKASI EMAIL
app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    const db = readDB();

    const userIndex = db.users.findIndex(u => u.email === email);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    if (db.users[userIndex].verificationCode === code) {
        db.users[userIndex].isVerified = true;
        writeDB(db);
        return res.json({ success: true, message: 'Akun lo resmi Terverifikasi! 🔥', user: db.users[userIndex] });
    } else {
        return res.status(400).json({ success: false, message: 'Kode salah atau lu typo!' });
    }
});

// 4. API UPDATE PROFILE
app.post('/api/profile/update', (req, res) => {
    const { id, username, password, avatar } = req.body;
    const db = readDB();

    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    if (username) db.users[userIndex].username = username;
    if (password) db.users[userIndex].password = password;
    if (avatar) db.users[userIndex].avatar = avatar;

    writeDB(db);
    res.json({ success: true, message: 'Profil berhasil di-upgrade!', user: db.users[userIndex] });
});

// 5. API TOP UP SALDO
app.post('/api/profile/deposit', (req, res) => {
    const { id, amount } = req.body;
    const db = readDB();

    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    const depositAmount = parseInt(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) return res.status(400).json({ success: false, message: 'Nominal tidak valid.' });

    db.users[userIndex].balance = (db.users[userIndex].balance || 0) + depositAmount;
    db.users[userIndex].transactions = db.users[userIndex].transactions || [];
    db.users[userIndex].transactions.unshift({
        invoice: 'DEP-' + Date.now().toString().slice(-6),
        item: 'Top Up Saldo E-Wallet',
        price: depositAmount,
        type: 'IN',
        date: new Date().toLocaleString('id-ID')
    });

    writeDB(db);
    res.json({ success: true, message: `Sukses Top Up Rp ${depositAmount.toLocaleString('id-ID')}!`, user: db.users[userIndex] });
});

// 6. API BELI PRODUK
app.post('/api/buy', (req, res) => {
    const { userId, productName, productPrice } = req.body;
    const db = readDB();

    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'Login dulu sebelum beli dagangan!' });

    const user = db.users[userIndex];
    const harga = parseInt(productPrice);

    if ((user.balance || 0) < harga) return res.status(400).json({ success: false, message: 'Saldo tidak cukup.' });

    db.users[userIndex].balance -= harga;
    db.users[userIndex].transactions = db.users[userIndex].transactions || [];
    db.users[userIndex].transactions.unshift({
        invoice: 'TRX-' + Date.now().toString().slice(-6),
        item: productName,
        price: harga,
        type: 'OUT',
        date: new Date().toLocaleString('id-ID')
    });

    writeDB(db);
    res.json({ success: true, message: `Transaksi Sukses! Anda berhasil membeli [ ${productName} ]`, user: db.users[userIndex] });
});

app.listen(PORT, () => {
    console.log(`Server Eclipse Torii berjalan lancar di port ${PORT}`);
});
                                                      
