(w=>{
w.c||(w.c=()=>{})
let e=c.f={}
e.b=(b)=>{
const c=()=>b.media=g
let g=b.media??"all"
b.addEventListener?b.addEventListener("load",c):b.attachEvent&&b.attachEvent("onload",c)
setTimeout(()=>{
b.rel="stylesheet"
b.media="none"
})
setTimeout(c,3000)
}
e.p=()=>{
let es=w.document.getElementsByTagName("link")
for(let i=0;i<es.length;i++){
let el=es[i]
"preload"!==el.rel||"style"!==el.getAttribute("as")||el.getAttribute("data-loadcss")||(el.setAttribute("data-loadcss",!0),e.b(el))
}
}
if(!w.document.createElement("link").relList.supports("preload")){
e.p()
let f=w.setInterval(e.p,500)
w.addEventListener?w.addEventListener("load",()=>{
e.p()
w.clearInterval(f)
}):w.attachEvent&&w.attachEvent("onload",()=>{
e.p()
w.clearInterval(f)
})
}
})("undefined"!==typeof global?global:this)
