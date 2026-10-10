// FLOFLA payment API. Never put YooKassa secrets in the website or GitHub.
import catalog from '../catalog.json';
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
function cors(origin,env){const allowed=(env.SITE_ORIGIN||'https://polyejik.github.io').split(',').map(s=>s.trim());return allowed.includes(origin)?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'content-type','access-control-allow-methods':'GET, POST, OPTIONS'}:{}}
function b64(s){return btoa(s)}
async function yk(env,path,options={}){const response=await fetch('https://api.yookassa.ru/v3/'+path,{...options,headers:{'Authorization':'Basic '+b64(env.YK_SHOP_ID+':'+env.YK_SECRET_KEY),'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json();if(!response.ok)throw Error('YooKassa HTTP '+response.status+' '+(data.type||''));return data}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin')||'',ch=cors(origin,env);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:ch});
 if(url.pathname==='/health')return json({ok:true,configured:!!(env.DB&&env.YK_SHOP_ID&&env.YK_SECRET_KEY)},200,ch);
 if(url.pathname==='/catalog'&&request.method==='GET')return json({products:catalog.products},200,ch);
 if(url.pathname==='/checkout'&&request.method==='POST'){
   if(!ch['access-control-allow-origin'])return json({error:'Origin not allowed'},403,ch);
   if(!env.DB||!env.YK_SHOP_ID||!env.YK_SECRET_KEY||!env.RETURN_URL)return json({error:'Checkout not configured'},503,ch);
   let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400,ch)}
   const {sku,quantity=1,email,name,phone='',deliveryAddress=''}=input||{};
   const item=catalog.products.find(x=>x.sku===sku&&x.active);
   if(!item||!Number.isInteger(quantity)||quantity<1||quantity>3)return json({error:'Product unavailable'},400,ch);
   if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||String(name).length>120||String(email).length>254)return json({error:'Customer details invalid'},400,ch);
   if(!item.price_kopecks||item.price_kopecks<100)return json({error:'Price not configured'},503,ch);
   const total=item.price_kopecks*quantity,id=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO orders(id,items_json,total_kopecks,customer_email,customer_name,customer_phone,delivery_address) VALUES(?,?,?,?,?,?,?)').bind(id,JSON.stringify([{sku,quantity}]),total,email,name,phone,deliveryAddress).run();
   try{
     const payment=await yk(env,'payments',{method:'POST',headers:{'Idempotence-Key':id},body:JSON.stringify({amount:{value:(total/100).toFixed(2),currency:'RUB'},capture:true,confirmation:{type:'redirect',return_url:env.RETURN_URL+'?order='+encodeURIComponent(id)},description:'FLOFLA заказ '+id.slice(0,8),metadata:{order_id:id},receipt:{customer:{email},items:[{description:item.title,quantity:String(quantity),amount:{value:(item.price_kopecks/100).toFixed(2),currency:'RUB'},vat_code:Number(env.YK_VAT_CODE||1),payment_subject:'commodity',payment_mode:'full_prepayment'}]}})});
     await env.DB.prepare('UPDATE orders SET payment_id=? WHERE id=?').bind(payment.id,id).run();
     return json({orderId:id,confirmationUrl:payment.confirmation?.confirmation_url},200,ch);
   }catch(e){return json({error:'Payment creation failed'},502,ch)}
 }
 if(url.pathname==='/webhooks/yookassa'&&request.method==='POST'){
   if(!env.DB||!env.YK_SHOP_ID||!env.YK_SECRET_KEY)return json({error:'Not configured'},503);
   let event;try{event=await request.json()}catch{return json({error:'Invalid JSON'},400)}
   const paymentId=event?.object?.id;
   if(!paymentId||!/^[-\w]+$/.test(paymentId))return json({error:'Invalid event'},400);
   // Webhook payload is untrusted: verify current payment state with YooKassa API.
   let p;try{p=await yk(env,'payments/'+encodeURIComponent(paymentId))}catch{return json({error:'Verification failed'},503)}
   const id=p.metadata?.order_id;
   if(!id)return json({ok:true});
   const order=await env.DB.prepare('SELECT id,total_kopecks,payment_id,status FROM orders WHERE id=?').bind(id).first();
   if(!order||order.payment_id!==p.id||Math.round(Number(p.amount?.value)*100)!==order.total_kopecks||p.amount?.currency!=='RUB')return json({error:'Payment mismatch'},409);
   if(p.status==='succeeded'&&p.paid===true)await env.DB.prepare("UPDATE orders SET status='paid',paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP) WHERE id=? AND status='pending'").bind(id).run();
   if(p.status==='canceled')await env.DB.prepare("UPDATE orders SET status='canceled' WHERE id=? AND status='pending'").bind(id).run();
   return json({ok:true});
 }
 return json({error:'Not found'},404,ch);
}};
