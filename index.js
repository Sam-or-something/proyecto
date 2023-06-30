const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cors());
const secret = process.env.TOKEN_SECRET;

const port = process.env.PORT;

function generateToken(email) {
  return jwt.sign({ email: `${email}` }, secret, { expiresIn: '3600s' });
}


app.listen(port,
  () => console.log(`Server Started on port ${port}...`)
);


async function hashPassword(password) {
  const saltRounds = 10;

  const hashed = await new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, function (err, hash) {
      if (err) reject(err)
      resolve(hash)
    });
  })

  return hashed
};

app.get('/', (_, res) => {
  res.send("Holis");
})

app.post('/register', async (req, res) => {
  // preguntarle a Sofi
  const Name = req.body.Name;
  const lastName = req.body.lastName;
  const email = req.body.email;
  const hashedPassword = await hashPassword(req.body.password);

  const users = await prisma.user.findMany({
    where: {
      email: email
    }
  });

  if (users.length != 0) {
    console.log('User already exists')
    res.json({ success: "false" })
  }
  else {
    const user = await prisma.user.create({
      data: {
        email: email,
        name: Name,
        lastName: lastName,
        password: hashedPassword
      }
    });
    const token = generateToken(email);
    console.log('Created new User')
    res.json({ success: "true", token: `${token}` })
  }
});

app.post('/login', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const users = await prisma.user.findMany({
    where: {
      email: email
    }
  });

  if (users.length == 0) {
    console.log('User does not exist')
    res.json({ success: "false" })
  }
  else {
    const hashedPassword = users[0].password;
    bcrypt.compare(password, hashedPassword, function (err, result) {
      if (result) {
        const token = generateToken(email);
        console.log('Login successful')
        res.json({ success: "true", token: `${token}` })
      }
      else {
        console.log('Password is incorrect')
        res.json({ success: "false" })
      }
    });
  }
});