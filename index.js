const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const app = express();
const { PrismaClient } = require('@prisma/client');
const prisma = new  PrismaClient();
const port = 3000;

app.listen(port,
    ()=> console.log(`Server Started on port ${port}...`));

app.use(express.json());

app.post('/register', async(req,res)=>{
    // preguntarle a Sofi
    const name = req.body.name;
    const lastName = req.body.lastName;
    const email = req.body.email;
    const hashedPassword = await bcrypt.hash(req.body.password, 10, function(err, hash){
      if(err){
        console.log(err);
      }
    });
    const users = await prisma.user.findMany({
        where: {
          email: email
        }
      });
    
    if(users.length != 0){
        console.log('User already exists')
        res.sendStatus(409) 
    }
    else{
        const user = await prisma.user.create({
            data: {
              email: email,
              name: name,
              lastname: lastName,
              password: hashedPassword
            }
          });
          console.log ('Created new User')
          res.sendStatus(201)
    }
});

app.post('/login', async(req, res)=>{
    const email = req.body.email;
    const password = req.body.password;

    const users = await prisma.user.findMany({
        where: {
          email: email
        }
      });
    
    if(users.length == 0){
        console.log('User does not exist')
        res.sendStatus(404)
    }
    else{
        const hashedPassword = users[0].password;
        if(await bcrypt.compare(password, hashedPassword)){
            console.log('Login successful')
            res.send(`${email} is logged in`) 
        }
        else{
            console.log('Password is incorrect')
            res.send('Password incorrect')
        }
    }
});