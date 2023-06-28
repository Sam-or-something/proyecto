const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

const { PrismaClient } = require('@prisma/client');
const prisma = new  PrismaClient();

const app = express();
const port = process.env.PORT;

app.listen(port,
    ()=> console.log(`Server Started on port ${port}...`));

app.use(express.json());

app.post('/register', async(req,res)=>{
    // preguntarle a Sofi
    const name = req.body.name;
    const lastName = req.body.lastName;
    const email = req.body.email;

    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(req.body.password, salt, function(err, hash) {
          const hashedPassword = hash;
      });
    })

    const users = await prisma.user.findMany({
        where: {
          email: email
        }
      });
    
    if(users.length != 0){
        console.log('User already exists')
        res.json({success: "false"})
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
          res.json({success: "true"})
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
        res.json({success: "false"})
    }
    else{
        const hashedPassword = users[0].password;
        bcrypt.compare(password, hashedPassword, function(err, result) {
          if (result) {
            console.log('Login successful')
            res.json({success: "true"})
          }
          else{
            console.log('Password is incorrect')
            res.json({success: "false"})
          }
        });
    }
});