const express=require("express");
const fs=require("fs");
const path=require("path");
const app=express();
const PORT=process.env.PORT||3000;
app.use(express.json());
app.use(express.static(path.join(__dirname)));
const DATA_DIR=path.join(__dirname,"data");
const DATA_FILE=path.join(DATA_DIR,"data.json");
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR);
if(!fs.existsSync(DATA_FILE))fs.writeFileSync(DATA_FILE,"{}");
// API: 获取数据
app.get("/api/data",(req,res)=>{try{var d=JSON.parse(fs.readFileSync(DATA_FILE,"utf8"));res.json(d)}catch(e){res.json({})}});
// API: 保存数据
app.post("/api/data",(req,res)=>{try{fs.writeFileSync(DATA_FILE,JSON.stringify(req.body,null,2));res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.get("*",(req,res)=>{res.sendFile(path.join(__dirname,"index.html"))});
app.listen(PORT,"0.0.0.0",()=>{console.log("✨ 周沐汐的魔法抽奖已启动: http://0.0.0.0:"+PORT)});