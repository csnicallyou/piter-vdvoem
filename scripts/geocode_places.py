#!/usr/bin/env python3
"""One-off conservative geocoding of the guide's place data via OSM Nominatim.
Rate limit: <= one request per second. Never manufacture coordinates.
"""
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

HTML=Path("index.html")
REPORT=Path("geocoding-report.json")
PAT=re.compile(r'(<script id="db" type="application/json">)(.*?)(</script>)',re.S)
ADDRESS=re.compile(r"(?:\d{1,3}[-‑–]\w*|улиц|просп|наб\.|набережн|пер\.|переул|лит|шоссе|линия|площад|Казанская|Кирочная|Магнитогорская|Турбинная|Садовая)",re.I)
SKIP=re.compile(r"(?:в целом|неуточн|категория|спб покер клуб /|фотосессия|маяк по берегу|лютеранская кирха \(неуточнённая\)|автобус через город)",re.I)
STOP={"кафе","ресторан","бар","магазин","музей","экскурсия","кофейня","петербург","санкт","спб","заброшенный","заброшенная","заброшенное","здание","галерея","усадьба","арт","парк"}
def normalize(s):
 s=unicodedata.normalize("NFKC",s).lower().replace("ё","е")
 s=re.sub(r"[«»\"'()]"," ",s)
 return re.sub(r"[^a-zа-я0-9]+"," ",s).strip()
def words(s):
 return [w for w in normalize(s).split() if len(w)>=3 and w not in STOP]
def area_for(p):
 a=(p.get("area") or "").lower()
 if "выборг" in a or "выборг" in p["name"].lower():return "Выборг, Ленинградская область, Россия"
 if "гатчин" in a or "гатчин" in p["name"].lower():return "Гатчина, Ленинградская область, Россия"
 if "пушкин" in a or "царское село" in p["name"].lower():return "Пушкин, Санкт-Петербург, Россия"
 if "саблин" in a or "саблин" in p["name"].lower():return "Ульяновка, Ленинградская область, Россия"
 if "кронштадт" in a or "кронштадт" in p["name"].lower():return "Кронштадт, Санкт-Петербург, Россия"
 if "приозер" in a:return "Приозерский район, Ленинградская область, Россия"
 if "тихвин" in a:return "Тихвин, Ленинградская область, Россия"
 if "ломоносов" in a:return "Ломоносов, Санкт-Петербург, Россия"
 if "рощина" in a:return "Рощино, Ленинградская область, Россия"
 if "петергоф" in p["name"].lower():return "Петергоф, Санкт-Петербург, Россия"
 if "павловск" in p["name"].lower():return "Павловск, Санкт-Петербург, Россия"
 if "токсово" in a:return "Токсово, Ленинградская область, Россия"
 if "петербург" in a or not a or "уточнить" in a:return "Санкт-Петербург, Россия"
 return p.get("area","")+", Ленинградская область, Россия"
def compact_name(s):
 s=re.sub(r"\s*[—–-]\s*(?:ресторан|кафе|бар|музей|заброшенное здание|бильярд)$","",s,flags=re.I)
 s=re.sub(r"^(?:кафе|кофейня|ресторан|бар|бильярдная|магазин)\s+","",s,flags=re.I)
 s=re.sub(r"\s*\(экскурсия\)$","",s,flags=re.I)
 return s
last_request=0
def nominatim(q):
 global last_request
 delta=time.monotonic()-last_request
 if delta<1.2:time.sleep(1.2-delta)
 params=urllib.parse.urlencode({"q":q,"format":"jsonv2","limit":4,"addressdetails":1,"accept-language":"ru"})
 url="https://nominatim.openstreetmap.org/search?"+params
 req=urllib.request.Request(url,headers={"User-Agent":"PiterVdvoem-Guide/1.0 (https://github.com/csnicallyou/piter-vdvoem; noncommercial location indexing)","Accept":"application/json"})
 last_request=time.monotonic()
 try:
  with urllib.request.urlopen(req,timeout=22) as resp:return json.load(resp)
 except (urllib.error.URLError,TimeoutError,ValueError) as e:
  print("request_failed",str(e)[:120],flush=True)
  return []
def geo_distance(a,b):
 lat1,lon1=map(math.radians,a);lat2,lon2=map(math.radians,b)
 x=2*6371*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))
 return x
def confidence(p,hit):
 name=compact_name(p["name"])
 display=hit.get("display_name","").split(",")[0]
 n=normalize(name);d=normalize(display)
 nw=set(words(name));dw=set(words(display))
 overlap=len(nw&dw)/max(1,min(len(nw),len(dw)))
 fuzzy=SequenceMatcher(None,n,d).ratio()
 lat=float(hit["lat"]);lon=float(hit["lon"])
 # Large area centered around SPb and Leningrad oblast. Keep out-of-region matches out.
 if not 58.15<=lat<=61.85 or not 27.3<=lon<=35.5:return 0
 if "москва" in (p.get("area","").lower()):return 0
 if any(v in name.lower() for v in ("улица","проспект","магнитогорская","казанская","кирочная","турбинная","шоссе","переулок")):
  if not (ADDRESS.search(hit.get("display_name","")) or overlap>=0.8):return 0
 score=max(0.55*fuzzy+0.45*overlap,0.72*overlap+0.28*fuzzy)
 if n==d:score=1.0
 elif n and d and (n in d or d in n) and len(d)>5:score=max(score,.88)
 # Country/region constraint
 adr=hit.get("address",{})
 region=" ".join(map(str,[adr.get("state",""),adr.get("region",""),adr.get("city",""),adr.get("town",""),adr.get("municipality","")])).lower()
 if not ("петербург" in region or "ленинград" in region or "выборг" in region or "кронштадт" in region or "гатчин" in region or "пушкин" in region):
  score-=.08
 return round(score,3)
def main():
 html=HTML.read_text(encoding="utf-8")
 m=PAT.search(html)
 if not m:sys.exit("missing db script")
 data=json.loads(m[2])
 stats={"already":0,"new":0,"uncertain":0,"no_match":0,"skipped":0,"requests":0}
 uncertain=[]
 checked=0
 for p in data["places"]:
  if p.get("lat") is not None and p.get("lon") is not None:
   stats["already"]+=1
   continue
  if SKIP.search(p["name"]) or "москва" in (p.get("area","").lower()):
   stats["skipped"]+=1;continue
  q=compact_name(p["name"])+", "+area_for(p)
  hits=nominatim(q);stats["requests"]+=1
  if not hits:
   # Retry with short query only for distinctive names, not generic objects
   if len(words(p["name"]))>=2:
    hits=nominatim(compact_name(p["name"])+", Ленинградская область, Россия");stats["requests"]+=1
  candidates=sorted([(confidence(p,h),h) for h in hits],key=lambda x:x[0],reverse=True)
  if not candidates:
   stats["no_match"]+=1;continue
  score,hit=candidates[0]
  if score>=.82 and (len(candidates)==1 or (score-candidates[1][0]>=.07 or geo_distance((float(hit["lat"]),float(hit["lon"])),(float(candidates[1][1]["lat"]),float(candidates[1][1]["lon"])))<.2)):
   p["lat"]=round(float(hit["lat"]),6);p["lon"]=round(float(hit["lon"]),6)
   p["coordinate_status"]="Автоматически найдено в OpenStreetMap; требуется выборочная проверка"
   p["coordinate_source"]="OpenStreetMap Nominatim"
   p["coordinate_match_score"]=score
   p["coordinate_display_name"]=hit["display_name"]
   stats["new"]+=1
   print("MATCH",p["id"],p["name"],p["lat"],p["lon"],score,flush=True)
  else:
   stats["uncertain"]+=1
   uncertain.append({"id":p["id"],"name":p["name"],"candidate":hit["display_name"],"score":score})
  checked+=1
  if checked%30==0:print("PROGRESS",checked,stats,flush=True)
 data["data_version"]="geocoded-osm-1"
 result=json.dumps(data,ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
 html=html[:m.start(2)]+result+html[m.end(2):]
 HTML.write_text(html,encoding="utf-8")
 REPORT.write_text(json.dumps({"stats":stats,"uncertain":uncertain},ensure_ascii=False,indent=2),encoding="utf-8")
 print("DONE",stats,flush=True)
if __name__=="__main__":main()
