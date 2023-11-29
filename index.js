const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv').config();
const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const { expressjwt: jwt } = require('express-jwt');
const cors = require('cors');
const cookieParser = require('cookie-parser')

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: ["https://daskolar.vercel.app", "http://localhost:3000"],
  methods: ['POST', 'PUT', 'GET', 'DELETE', 'OPTIONS', 'HEAD'],
  credentials: true,
}));
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT;


const secret = process.env.TOKEN_SECRET;
function generateToken(user) {
  return jsonwebtoken.sign({ email: `${user.email}`, id: `${user.id}` }, secret, { expiresIn: '3h' });
}

const authenticateToken = (req, res, next) => {
  console.log("authenticating")
  //const token = req.cookies.access_token;
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) {
    console.log("no token")
    return res.json({ success: 'false' });
  }
  try {
    const decoded = jsonwebtoken.verify(token, secret,)
    req.decoded = decoded
    next()
  } catch {
    console.log("fail")
    res.sendStatus(401)
  }
}

 async function confirmarCurso(cursoId, userId){
  const existe = await prisma.Curso.findMany({
    where: {
      id: cursoId,
      profs:{
        some:{
          id : userId
        }
      }
    }
  })

  if(existe[0]){
    return true
  }
  else{
    console.log(`no existe`)
    return false
  }
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

app.get('/', authenticateToken, async (req, res) => {
  console.log(req.decoded)
})

app.post('/register', async (req, res) => {
  const Name = req.body.Name;
  const lastName = req.body.lastName;
  const email = req.body.email;
  const hashedPassword = await hashPassword(req.body.password);

  //confirmar que no exista otra cuenta con el mismo email
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
    //crear usuario
    const user = await prisma.User.create({
      data: {
        email: email,
        name: Name,
        lastName: lastName,
        password: hashedPassword
      }
    });
    console.log('Created new User')
    res.json({ success: "true"})
  }
});

app.post('/login', async (req, res) => {
  console.log('logging in')
  const email = req.body.email;
  const password = req.body.password;

  //confirmar existencia de usuario con ese mail
  const user = await prisma.User.findUnique({
    where: {
      email: email
    }
  });

  if (!user) {
    console.log('User does not exist')
    res.json({ success: "false" })
  }
  else {
    //autenticar contraseña
    const hashedPassword = user.password;
    bcrypt.compare(password, hashedPassword, function (err, result) {
      if (result) {
        const token = generateToken(user);
        console.log('Login successful')
        res.json({ success: "true", token: token })
      }
      else {
        console.log('Password is incorrect')
        res.json({ success: "false" })
      }
    });
  }
});


app.post('/crear-curso', authenticateToken, async(req, res) => { 
  const Name = req.body.Name;
  const anio = req.body.anio;
  const materia = req.body.materia;
  const decoded = req.decoded
  const id = parseInt(decoded.id)
  const alumnos = req.body.alumnos.split(";")

  var continuar = true
  console.log(req.body.profesores)

  if(req.body.profesores){
    var otherUser = req.body.profesores.split(";")
    let noExisteOther =[]
    for(const email of otherUser){
      let existeOther = await prisma.User.findMany({
          where: {
            email: email
          }
      })
      if(!existeOther[0]){
        noExisteOther.push(email)
      }
    }

    if(noExisteOther[0]){
      console.log(`emails ${noExisteOther} do not belong to existing accounts`)
      res.json({success: "false", noExisten: noExisteOther})
      continuar = false
    }  
  }
  
  if(continuar){
    var newCurso
    //crear curso
    newCurso = await prisma.Curso.create({
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
    if(otherUser){
      for(const email of otherUser){
        const other = await prisma.User.findMany({
          where:{
            email: email
          }
        })
        const updateado = await prisma.Curso.update({
          where:{
            id: newCurso.id
          },
          data:{
            profs:{
              connect:{
                id: other[0].id
              }
            }
          }
        })
      }
    }
  

    //crear alumnos y poner en el curso
    for(const alumno of alumnos){
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

app.get('/cursos', authenticateToken, async(req, res) => {
  console.log("cursos called")
  const decoded = req.decoded
  const id = parseInt(decoded.id)
  
  const cursos = await prisma.User.findUnique({
    where: {
      id: id
    },
    select: {
      cursos: true
    }
  });
  console.log("Showing cursos")
  res.json(cursos.cursos)
})

async function mostrarCurso(curso, id){
  const existe = await confirmarCurso(curso, id)
  var conLog
  var resJson
  if(existe){
    const alumnos = await prisma.Alumno.findMany({
      where: {
        idCurso: curso
      },
      orderBy:{
        Name:'asc'
      },
      select: {
        Name: true,
        id: true
      }
    })

    const Modelos = await prisma.ModTrabajo.findMany({
      where: {
        idCurso: curso
      },
      select: {
        Name: true,
        id: true
      }
    })

    var notas = []

    for(const alumno of alumnos) {
      var tbjs = []
      for(const modelo of Modelos) {
        const notasAlumno = await prisma.Trabajo.findMany({
          where: {
            idAlumno: alumno.id,
            idMod : modelo.id
          },
          select:{
            nota: true,
            comentario: true,
            id: true,
            idMod: true,
            idAlumno: true
          }
        })
        if(notasAlumno[0]){
          var trbj = {Name: modelo.Name, idTrabajo: notasAlumno[0].id, idMod: modelo.id, nota: notasAlumno[0].nota, comentario: notasAlumno[0].comentario}
          tbjs.push(trbj)
        }
      }
      notas.push({id: alumno.id, Name: alumno.Name, trabajos: tbjs})
    }
    conLog = `curso ${curso} showing`
    resJson = {alumnos: notas, success: "true"} 
  }
  else{
    conLog = `curso ${curso} is not accesible`
    resJson = {success: "false"}
  }
  return {conLog: conLog, resJson: resJson}
}

app.get('/cursos/:cursoId', authenticateToken, async(req, res) => {
  const curso = parseInt(req.params.cursoId)
  const decoded = req.decoded
  const id = parseInt(decoded.id)

  const respuesta = await mostrarCurso(curso, id)
  console.log(respuesta.conLog)
  res.json(respuesta.resJson)
})
 
app.post('/cursos/:cursoId/crear-trabajo', authenticateToken, async(req, res) =>{
  const cursoId = parseInt(req.params.cursoId)
  const decoded = req.decoded
  const userId = parseInt(decoded.id)
  const Name = req.body.Name

  //confirmar existencia del curso
  const existe = await confirmarCurso(cursoId, userId)

  if(existe){
    //confirmar que nombre no existe
    const repetido = await prisma.Curso.findMany({
      where: {
        id: cursoId,
        MTrabajos:{
          some:{
            Name : Name
          }
        }
      }
    })

    if(repetido[0]){
      console.log(`Trabajo llamado ${Name} ya existe en este curso`)
      res.json({success: "false"})
    }
    else{
      //lista alumnos
      const alumnos = await prisma.Alumno.findMany({
        where: {
          idCurso: cursoId
        }
      })

      //crear modelo
      const newModelo = await prisma.ModTrabajo.create({
        data: {
          Name: Name,
          curso: {
            connect:{
              id: cursoId
            }
          }
        }
      })

      console.log("new modelo created")
      
      for(const alumno of alumnos){
        const existe = await prisma.Trabajo.findMany({
          where:{
            idAlumno: alumno.id,
            idMod: newModelo.id
          }
        })
        if(existe[0]){
          console.log('error de identificacion')
          res.json({success: "false"})
        }
        else{
          const trabajos = await prisma.ModTrabajo.update({
            where: {
              id : newModelo.id
            },
            data:{
              trabajos:{
                create:{
                  nota: "0",
                  comentario: "---",
                  alumno: {
                    connect: {
                      id:alumno.id
                    }
                  }
                }
              }
            }
          })
        }
      }
      console.log(`trabajo ${Name} successfully created`)
      res.json({success: "true"})
    }
  }
  else{
    console.log(`curso id ${curso} does not exist`)
    res.json({success: "false"})
  }
})

app.get('/cursos/:cursoId/editar', authenticateToken, async(req, res) => {
  const curso = parseInt(req.params.cursoId)
  const decoded = req.decoded
  const id = parseInt(decoded.id)

  const respuesta = await mostrarCurso(curso, id)
  console.log(`editar ${respuesta.conLog}`)
  res.json(respuesta.resJson)
})

app.post('/cursos/:cursoId/editar', authenticateToken, async(req, res) => {
  console.log("called")
  const cursoId = parseInt(req.params.cursoId)
  const decoded = req.decoded
  const userId = parseInt(decoded.id)
  const datos = req.body.alumnos

  //confirmar existencia del curso
  const existe = confirmarCurso(cursoId, userId)

  if(existe){
    for(const alumno of datos){
      for(const trabajo of alumno.trabajos){
        const update = await prisma.Trabajo.update({
          where:{
            idAlumno: alumno.id,
            idMod: trabajo.idMod,
            id: trabajo.idTrabajo
          },
          data:{
            nota: trabajo.nota,
            comentario: trabajo.comentario
          }
        })
      }
    }
    console.log(`curso ${cursoId} updated`)
    res.json({success: true})
  }
  else{
    console.log(`curso id ${curso} does not exist`)
    res.json({success: "false"})
  }
})