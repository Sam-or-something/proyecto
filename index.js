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
app.use(cors({
  origin: ["https://daskolar.vercel.app", "http://localhost:3000"]
}));
const secret = process.env.TOKEN_SECRET;

const port = process.env.PORT;

function generateToken(user) {
  return jwt.sign({ email: `${user.email}`, id: `${user.id}` }, secret, { expiresIn: '3h' });
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

  const users = await prisma.User.findMany({
    where: {
      email: email
    }
  });

  if (users.length != 0) {
    console.log('User already exists')
    res.json({ success: "false" })
  }
  else {
    const user = await prisma.User.create({
      data: {
        email: email,
        name: Name,
        lastName: lastName,
        password: hashedPassword
      }
    });
    const token = generateToken(user);
    console.log('Created new User')
    res.json({ success: "true", token: `${token}` })
  }
});

app.post('/login', async (req, res) => {
  // const email = req.body.email;
  // const password = req.body.password;
  res.json({return:`${req.body}`});
  /*const user = await prisma.User.findUnique({
    where: {
      email: email
    }
  });

  if (user.length == 0) {
    console.log('User does not exist')
    res.json({ success: "false" })
  }
  else {
    const hashedPassword = user.password;
    bcrypt.compare(password, hashedPassword, function (err, result) {
      if (result) {
        const token = generateToken(user);
        console.log('Login successful')
        res.json({ success: "true", token: `${token}` })
      }
      else {
        console.log('Password is incorrect')
        res.json({ success: "false" })
      }
    });
  }*/
});


app.post('/crear-curso', async(req, res) => { 
  const Name = req.body.Name;
  const anio = req.body.anio;
  const materia = req.body.materia;
  const token = req.body.token
  const decoded = jwt.verify(token, secret)
  const id = parseInt(decoded.id)
  const cursos = await prisma.User.findUnique({
    where: {
      id: id
    },
    select: { 
      cursos: true
    }
  });
  const alumnos = req.body.alumnos.split(",")

  let existe = false;
  for (curso of cursos.cursos){
    if(curso.Name == Name){
      existe = true
    }
  }

  if(existe){
    console.log('Curso name already exists')
    res.json({ success: "false" })
  }
  else{
  const newCurso = await prisma.Curso.create({
    data: {
      Name: Name,
      anio: anio,
      materia: materia,
      profs: {
        connect:{
            id: id
        }
      }
    }
  })

  for(alumno of alumnos){
    const cursoUpdated = await prisma.Curso.update({
        where:{
          id: newCurso.id
        },
        data:{
          alumnos:{
            create:{
              Name: alumno
            }
          }
        }
      })
  }
  

  console.log('Created new curso')
  res.json({ success: "true" , resultado: newCurso})
  }
})

app.post('/cursos', async(req, res) => {
  const token = req.body.token
  const decoded = jwt.verify(token, secret)
  const id = parseInt(decoded.id)

  const cursos = await prisma.User.findUnique({
    where: {
      id: id
    },
    select: {
      cursos: true
    }
  });

  res.json(cursos.cursos)
})

app.post('/cursos/:cursoId', async(req, res) => {
  const curso = parseInt(req.params.cursoId)
  const token = req.body.token
  const decoded = jwt.verify(token, secret)
  const id = parseInt(decoded.id)

  const existe = await prisma.Curso.findMany({
    where: {
      id: curso,
      profs:{
        some:{
          id : id
        }
      }
    }
  })

  if(existe[0]){
    const alumnos = await prisma.Alumno.findMany({
      where: {
        idCurso: curso
      },
      select: {
        Name: true,
        id: true
      }
    })
    res.json(alumnos)
    console.log(`curso ${curso} showing`)
  }
  else{
  console.log(`curso ${curso} is not accesible`)
  }
})

app.post('/cursos/:cursoId/edit', async(req, res) => {
  
})