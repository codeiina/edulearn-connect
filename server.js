require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Konfigurasi upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.STORAGE_PATH || path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// ROUTE: Home
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM users ORDER BY id DESC');
  const users = result.rows;
  const success = req.query.success === 'true';

  const html = `
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EduLearn Connect</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://unpkg.com/cropperjs/dist/cropper.css" rel="stylesheet"/>
    <script src="https://unpkg.com/cropperjs/dist/cropper.js"></script>
  </head>
  <body class="bg-gray-50 min-h-screen flex flex-col items-center">
    <header class="w-full text-center py-6 bg-gradient-to-r from-blue-600 to-indigo-500 shadow-md">
      <h1 class="text-3xl font-bold text-white">📘 EduLearn Connect</h1>
    </header>

    ${success ? `
    <div class="mt-4 bg-green-100 text-green-800 px-4 py-2 rounded-lg border border-green-300 shadow-sm animate-bounce">
      ✅ Data berhasil ditambahkan!
    </div>` : ''}

    <section class="mt-8 w-full max-w-lg bg-white p-6 rounded-2xl shadow-md border border-gray-100">
      <form id="userForm" action="/add" method="POST" enctype="multipart/form-data" class="flex flex-col gap-4">
        <input type="text" name="name" placeholder="Nama Lengkap" required
          class="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        <input type="email" name="email" placeholder="Alamat Email" required
          class="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
        <input type="file" id="imageInput" name="profile_pic" accept="image/*" required
          class="p-2 text-sm text-gray-600">

        <div class="flex justify-center">
          <img id="preview" class="max-h-64 rounded-lg hidden border border-gray-200"/>
        </div>

        <button type="button" id="cropBtn"
          class="bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition hidden">
          Crop Foto
        </button>

        <button type="submit"
          class="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition transform hover:scale-105">
          Simpan Data
        </button>
      </form>
    </section>

    <section class="mt-10 w-full max-w-5xl px-4">
      <h2 class="text-2xl font-semibold text-gray-800 mb-6">Daftar Pengguna</h2>

      ${users.length === 0 ? `
        <p class="text-gray-500 italic text-center">Belum ada data pengguna.</p>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          ${users.map(u => `
            <div class="bg-white rounded-xl shadow hover:shadow-lg transition duration-300 border border-gray-100">
              <img src="/uploads/${path.basename(u.profile_pic)}" alt="${u.name}" class="w-full h-48 object-cover rounded-t-xl">
              <div class="p-4">
                <h3 class="font-semibold text-lg text-gray-800">${u.name}</h3>
                <p class="text-gray-500 text-sm">${u.email}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </section>

    <footer class="mt-10 mb-4 text-sm text-gray-500">© 2025 EduLearn Connect</footer>

    <script>
      let cropper;
      const imageInput = document.getElementById('imageInput');
      const preview = document.getElementById('preview');
      const cropBtn = document.getElementById('cropBtn');
      const form = document.getElementById('userForm');

      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          preview.src = reader.result;
          preview.classList.remove('hidden');
          if (cropper) cropper.destroy();
          cropper = new Cropper(preview, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
          });
          cropBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      });

      cropBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
        canvas.toBlob(blob => {
          const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });

          // ganti input file dengan hasil crop
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          imageInput.files = dataTransfer.files;

          // update preview ke hasil crop
          preview.src = canvas.toDataURL();
          cropper.destroy();
          cropBtn.classList.add('hidden');
        }, 'image/jpeg');
      });
    </script>
  </body>
  </html>
  `;

  res.send(html);
});

// ROUTE: Tambah Data
app.post('/add', upload.single('profile_pic'), async (req, res) => {
  try {
    const { name, email } = req.body;
    const filePath = req.file.path;

    await pool.query(
      'INSERT INTO users (name, email, profile_pic) VALUES ($1, $2, $3)',
      [name, email, filePath]
    );

    res.redirect('/?success=true');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan data.');
  }
});

app.listen(port, () =>
  console.log(`✅ Server running at http://localhost:${port}`)
);
