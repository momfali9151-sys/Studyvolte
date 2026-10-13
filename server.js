require('dotenv').config();
const express=require('express');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const multer=require('multer');
const bcrypt=require('bcryptjs');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const app=express();
const PORT=Number(process.env.PORT||3000);
const MAX_MB=Number(process.env.MAX_FILE_MB||50);
const ROOT=__dirname;
const PUBLIC=path.join(ROOT,'public');
const DATA=path.join(ROOT,'data');
const UPLOADS=path.join(ROOT,'uploads');
const DB_FILE=path.join(DATA,'db.json');
for(const d of [DATA,UPLOADS]) fs.mkdirSync(d,{recursive:true});

const SUBJECTS={
 BCA:[
  {slug:'functional-english',name:'Functional English',icon:'🗣️'},
  {slug:'iit-tools',name:'IIT Tools',icon:'🧰'}
 ],
 'B-Pharma':[
  {slug:'health-care-communication-skill',name:'Health Care and Communication Skill',icon:'🩺'},
  {slug:'basics-of-python-programming',name:'Basics of Python Programming',icon:'🐍'},
  {slug:'general-pharmacy',name:'General Pharmacy',icon:'💊'},
  {slug:'human-anatomy-physiology-pathophysiology',name:'Human Anatomy, Physiology and Pathophysiology',icon:'🫀'},
  {slug:'introduction-to-pharmacognosy',name:'Introduction to Pharmacognosy',icon:'🌿'},
  {slug:'pharmaceutical-inorganic-analytical-chemistry',name:'Pharmaceutical Inorganic and Analytical Chemistry',icon:'⚗️'}
 ]
};
const ALLOWED=new Set(['.pdf','.doc','.docx','.ppt','.pptx','.txt','.c','.cpp','.java','.py','.html','.css','.js','.zip','.jpg','.jpeg','.png']);
const MIME={'.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.txt':'text/plain','.c':'text/plain','.cpp':'text/plain','.java':'text/plain','.py':'text/plain','.html':'text/html','.css':'text/css','.js':'text/javascript','.zip':'application/zip','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};

function loadDB(){
 if(!fs.existsSync(DB_FILE)) return {users:[],files:[],sessions:[]};
 try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{return {users:[],files:[],sessions:[]};}
}
let db=loadDB();
function saveDB(){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));}
function seedAdmin(){
 if(db.users.some(u=>u.role==='admin')) return;
 const email=(process.env.ADMIN_EMAIL||'admin@studyvault.local').trim().toLowerCase();
 const password=process.env.ADMIN_PASSWORD||'ChangeThisPassword123!';
 db.users.push({id:crypto.randomUUID(),email,passwordHash:bcrypt.hashSync(password,12),role:'admin',createdAt:new Date().toISOString()});
 saveDB();
 console.log(`Admin created: ${email}`);
}
seedAdmin();

app.disable('x-powered-by');
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
app.use('/api/auth/login',rateLimit({windowMs:15*60*1000,max:20,standardHeaders:true,legacyHeaders:false}));
app.use(express.static(PUBLIC));

function publicSubject(course,subject){return (SUBJECTS[course]||[]).find(s=>s.slug===subject);}
function sessionUser(req){
 const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) return null;
 const token=h.slice(7); const s=db.sessions.find(x=>x.token===token && new Date(x.expiresAt)>new Date());
 return s?db.users.find(u=>u.id===s.userId):null;
}
function adminOnly(req,res,next){const u=sessionUser(req); if(!u||u.role!=='admin') return res.status(401).json({success:false,message:'Admin login required.'}); req.user=u; next();}
function safeName(name){return path.basename(name).replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/\s+/g,' ').slice(0,150)||'file';}

const storage=multer.diskStorage({
 destination:(req,file,cb)=>{const course=req.body.course,subject=req.body.subject;if(!publicSubject(course,subject)) return cb(new Error('Invalid course or subject.'));const dir=path.join(UPLOADS,course,subject);fs.mkdirSync(dir,{recursive:true});cb(null,dir);},
 filename:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();cb(null,`${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${safeName(path.basename(file.originalname,ext))}${ext}`);}
});
const upload=multer({storage,limits:{fileSize:MAX_MB*1024*1024},fileFilter:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();cb(ALLOWED.has(ext)?null:new Error('This file type is not allowed.'),ALLOWED.has(ext));}});

app.get('/api/courses',(req,res)=>res.json({success:true,courses:Object.entries(SUBJECTS).map(([course,subjects])=>({course,subjects}))}));
app.get('/api/files',(req,res)=>{
 const {course,subject,q=''}=req.query;
 let files=db.files.filter(f=>(!course||f.course===course)&&(!subject||f.subject===subject));
 if(q) files=files.filter(f=>f.originalName.toLowerCase().includes(String(q).toLowerCase()));
 res.json({success:true,files:files.sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt)).map(f=>({...f,url:`/api/files/${f.id}/open`,downloadUrl:`/api/files/${f.id}/download`}))});
});
app.get('/api/files/:id/open',(req,res)=>serveFile(req,res,false));
app.get('/api/files/:id/download',(req,res)=>serveFile(req,res,true));
function serveFile(req,res,download){const f=db.files.find(x=>x.id===req.params.id);if(!f)return res.status(404).send('File not found');const full=path.join(UPLOADS,f.storedPath);if(!fs.existsSync(full))return res.status(404).send('File missing');if(download)res.download(full,f.originalName);else res.type(f.mime||'application/octet-stream').sendFile(full);}

app.post('/api/auth/login', (req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
 const u=db.users.find(x=>x.email===email&&x.role==='admin');
 if(!u||!bcrypt.compareSync(password,u.passwordHash)) return res.status(401).json({success:false,message:'Invalid admin email or password.'});
 const token=crypto.randomBytes(48).toString('hex'); const hours=Number(process.env.SESSION_HOURS||12);
 db.sessions=db.sessions.filter(s=>new Date(s.expiresAt)>new Date());db.sessions.push({token,userId:u.id,expiresAt:new Date(Date.now()+hours*3600000).toISOString()});saveDB();
 res.json({success:true,token,user:{email:u.email,role:u.role}});
});
app.post('/api/auth/logout',(req,res)=>{const h=req.headers.authorization||'';if(h.startsWith('Bearer '))db.sessions=db.sessions.filter(s=>s.token!==h.slice(7));saveDB();res.json({success:true});});
app.post('/api/auth/change-password',adminOnly,(req,res)=>{
 const current=String(req.body.currentPassword||''),next=String(req.body.newPassword||'');
 if(next.length<8)return res.status(400).json({success:false,message:'New password must be at least 8 characters.'});
 if(!bcrypt.compareSync(current,req.user.passwordHash))return res.status(400).json({success:false,message:'Current password is incorrect.'});
 const u=db.users.find(x=>x.id===req.user.id);u.passwordHash=bcrypt.hashSync(next,12);db.sessions=db.sessions.filter(s=>s.userId!==u.id);saveDB();res.json({success:true,message:'Password changed. Please login again.'});
});

app.post('/api/admin/files',adminOnly,upload.single('file'),(req,res)=>{
 if(!req.file)return res.status(400).json({success:false,message:'Please select a file.'});
 const ext=path.extname(req.file.originalname).toLowerCase();
 const f={id:crypto.randomUUID(),course:req.body.course,subject:req.body.subject,originalName:req.file.originalname,storedPath:path.relative(UPLOADS,req.file.path).replace(/\\/g,'/'),mime:MIME[ext]||req.file.mimetype,size:req.file.size,uploadedAt:new Date().toISOString(),uploadedBy:req.user.email};
 db.files.push(f);saveDB();res.json({success:true,message:'File uploaded successfully.',file:f});
});
app.delete('/api/admin/files/:id',adminOnly,(req,res)=>{const i=db.files.findIndex(f=>f.id===req.params.id);if(i<0)return res.status(404).json({success:false,message:'File not found.'});const f=db.files[i],full=path.join(UPLOADS,f.storedPath);try{if(fs.existsSync(full))fs.unlinkSync(full);}catch{}db.files.splice(i,1);saveDB();res.json({success:true,message:'File deleted.'});});
app.get('/api/admin/stats',adminOnly,(req,res)=>{const total=db.files.reduce((n,f)=>n+f.size,0);res.json({success:true,stats:{files:db.files.length,storage:total,subjects:new Set(db.files.map(f=>`${f.course}/${f.subject}`)).size}});});
app.get('/api/admin/files',adminOnly,(req,res)=>res.json({success:true,files:db.files.sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt))}));

app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(PUBLIC,'index.html'));});
app.use((err,req,res,next)=>{console.error(err);res.status(400).json({success:false,message:err.message||'Something went wrong.'});});
app.listen(PORT,()=>console.log(`\nStudyVault running at http://localhost:${PORT}\nAdmin: ${process.env.ADMIN_EMAIL||'admin@studyvault.local'}\n`));
