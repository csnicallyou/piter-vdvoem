#!/usr/bin/env python3
"""Geocode independently verified street addresses. One-shot, rate-limited.
Address sources are preserved in place records for review.
"""
import json,re,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path
P=Path("index.html")
M=re.compile(r'(<script id="db" type="application/json">)(.*?)(</script>)',re.S)
# ID: street address, source, note. Do not infer coordinates from business name.
ADDRESSES={
 11:("Санкт-Петербург, Большая Морская улица, 30","https://www.google.com/maps/search/?api=1&query=Sea+Signora+Большая+Морская+30",""),
 25:("Санкт-Петербург, Столярный переулок, 18/69","https://www.severyanin.me/",""),
 57:("Санкт-Петербург, Владимирский проспект, 18","https://yandex.com/maps/org/el_copitas_bar/72067240437/",""),
 63:("Санкт-Петербург, Разъезжая улица, 37","https://molotbar.ru/",""),
 41:("Санкт-Петербург, Большая Конюшенная улица, 9","https://yandex.by/maps/org/opetit/219951920483/",""),
 48:("Санкт-Петербург, Кадетская линия, 5 корпус 2Д","https://rythm.yandex.ru/businesses/%4033ideas","кафе Институт, Вавилов Лофт"),
 99:("Санкт-Петербург, Бухарестская улица, 30/32","https://mazapark.ru/","МазаПарк, выбран филиал на Бухарестской"),
 112:("Санкт-Петербург, Караванная улица, 12","https://afisha.yandex.ru/saint-petersburg/cinema/places/rodina-spb",""),
 156:("Санкт-Петербург, Большой проспект Васильевского острова, 74","https://www.paleohunters.ru/contacts/",""),
 181:("Санкт-Петербург, 13-я линия Васильевского острова, 70","https://artmuza.spb.ru/contacts.html",""),
 23:("Санкт-Петербург, Лермонтовский проспект, 2","https://sinagoga.jeps.ru/sinagoga/restoran-lexajm.html","ресторан Лехаим"),
 299:("Санкт-Петербург, улица Куйбышева, 9/8","https://www.soulmatespb.com/","Soulmate: выбран филиал на Куйбышева"),
 47:("Санкт-Петербург, Казанская улица, 7","https://www.google.com/maps/search/?api=1&query=Казанская+7+Санкт-Петербург","адрес из исходного списка"),
 211:("Санкт-Петербург, Казанская улица, 7","https://www.google.com/maps/search/?api=1&query=Казанская+7+Санкт-Петербург","адрес из исходного списка"),
 213:("Санкт-Петербург, Ковенский переулок, 14","https://www.google.com/maps/search/?api=1&query=Ковенский+14+Санкт-Петербург","адрес из исходного списка"),
 217:("Санкт-Петербург, Кирочная улица, 40","https://www.google.com/maps/search/?api=1&query=Кирочная+40+Санкт-Петербург","адрес из исходного списка"),
 227:("Санкт-Петербург, 15-я линия Васильевского острова, 2/27","https://www.google.com/maps/search/?api=1&query=15-я+линия+2/27+Санкт-Петербург","адрес из исходного списка"),
 220:("Санкт-Петербург, Магнитогорская улица, 71","https://www.google.com/maps/search/?api=1&query=Магнитогорская+71+Санкт-Петербург","адрес из исходного списка"),
 116:("Санкт-Петербург, Магнитогорская улица, 53","https://www.google.com/maps/search/?api=1&query=Магнитогорская+53+Санкт-Петербург","адрес из исходного списка; только ориентир снаружи"),
 139:("Санкт-Петербург, проспект Обуховской Обороны, 71","https://www.google.com/maps/search/?api=1&query=Обуховской+Обороны+71+Санкт-Петербург","адрес из исходного списка; только ориентир"),
 143:("Санкт-Петербург, Турбинная улица, 9","https://www.google.com/maps/search/?api=1&query=Турбинная+9+Санкт-Петербург","ориентир у домов 9 и 11"),
 285:("Санкт-Петербург, 11-я Красноармейская улица, 11","https://www.google.com/maps/search/?api=1&query=11-я+Красноармейская+11+Санкт-Петербург","адрес из исходного списка"),
 94:("Санкт-Петербург, Приморский проспект, 72","https://www.google.com/maps/search/?api=1&query=ТРК+Питерлэнд","ТРК Питерлэнд, точка ТЦ, этаж уточнить"),
 89:("Санкт-Петербург, Лиговский проспект, 30А","https://www.google.com/maps/search/?api=1&query=ТРЦ+Галерея+СПб","ТЦ Галерея, точка ТЦ, фотобудку уточнить"),
 105:("Санкт-Петербург, улица Ефимова, 2","https://www.google.com/maps/search/?api=1&query=ТРК+ПИК+СПб","ТРК ПИК, точка ТЦ"),
}
def query(addr):
 qs=urllib.parse.urlencode({"q":addr,"format":"jsonv2","addressdetails":1,"limit":5,"accept-language":"ru"})
 req=urllib.request.Request("https://nominatim.openstreetmap.org/search?"+qs,headers={"User-Agent":"PiterVdvoem-Guide/1.0 (+https://github.com/csnicallyou/piter-vdvoem)"})
 with urllib.request.urlopen(req,timeout=24) as r:return json.load(r)
def main():
 s=P.read_text("utf-8");m=M.search(s)
 if not m:raise RuntimeError("embedded data missing")
 d=json.loads(m[2]);pmap={p["id"]:p for p in d["places"]}
 log=[]
 for id,(address,source,note) in ADDRESSES.items():
  p=pmap.get(id)
  if not p or p.get("lat") is not None:continue
  try:
   found=query(address)
  except Exception as e:
   log.append({"id":id,"address":address,"status":"network_error","error":str(e)[:100]});time.sleep(1.5);continue
  time.sleep(1.2)
  norm=lambda s:re.sub(r'[^0-9а-яa-z]+',' ',s.lower().replace('ё','е'))
  nums=re.findall(r'\b\d+\b',address)
  # Must find address in St Petersburg and not an obviously unrelated street.
  out=[]
  for f in found:
   lat,lon=float(f["lat"]),float(f["lon"])
   disp=f.get("display_name","")
   if not 59.6<lat<60.2 or not 29.5<lon<31.1:continue
   street=address.split(",")[1].strip().split(" улица")[0].split(" проспект")[0].split(" переулок")[0].strip()
   streettokens=[w for w in norm(street).split() if len(w)>3 and w not in {"улица","проспект","переулок","линия","набережная"}]
   if streettokens and not any(w in norm(disp) for w in streettokens):continue
   out.append(f)
  if not out:
   log.append({"id":id,"address":address,"status":"no_reliable_match","candidates":[x.get("display_name","") for x in found[:2]]});continue
  f=out[0]
  # Do not assert GPS precision: address centroid is an approximate pin.
  p.update(lat=round(float(f["lat"]),6),lon=round(float(f["lon"]),6),coordinate_status="Ориентир по подтверждённому адресу — геокодировано через OSM",coordinate_source=source,verified_address=address)
  if note:p["coordinate_note"]=note
  log.append({"id":id,"name":p["name"],"status":"added","address":address,"lat":p["lat"],"lon":p["lon"],"source":source})
  print("ADDED",id,p["name"],p["lat"],p["lon"],flush=True)
 new=json.dumps(d,ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
 P.write_text(s[:m.start(2)]+new+s[m.end(2):],encoding="utf-8")
 Path("verified-addresses-report.json").write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding="utf-8")
 print("SUMMARY",len([x for x in log if x["status"]=="added"]),"of",len(ADDRESSES),flush=True)
if __name__=="__main__":main()
