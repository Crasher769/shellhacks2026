import re
from flask import Flask, jsonify, requests



response_obj = jsonify(data)
doc = response_obj.get_data(as_text=True)

words = doc.split()
email = []
streets = []
username = []
phone = []

#Phone number
phone_pattern = r'\b\d{3}-\d{3}-\d{4}\b'
phone_c = re.findall(phone_pattern, doc)
phone.extend(phone_c)
phone_c.clear()
phone_pattern = r'\(\b\d{3}\)-\d{3}-\d{4}\b' #Parenthesis
phone.extend(re.findall(phone_pattern, doc))
print(f'Phones found: {', ' .join(phone)}')

#Email
for word in words:
    if '@' in word and '.' in word:
        email.append(word)
print(f'Emails found: {', ' .join(email)}')

#address
for word in words:
    if word in {'ST','AVE','BLVD','RD','DR','LN','CT','CIR','PKWY','HWY','PL','TER','TRL','WAY','APT','STE','BLDG','FL','STREET','AVENUE','ROAD','BOULEVARD','DRIVE','LANE','COURT','CIRCLE','PARKWAY','HIGHWAY','PLACE','TERRACE','TRAIL','APARTMENT','SUITE','BUILDING','FLOOR','CITY','TOWN','VILLAGE','COUNTY','STATE','HEIGHTS','HILLS','JUNCTION','VALLEY','MANOR','MEADOW','PINES','GROVE','PARK','PLAZA','SQUARE','COVE','CROSSING','ESTATES','LANDING','POINT','RIDGE','VIEW','VISTA','GARDENS','SPRINGS','CREEK','LAKE','LAKES','BEACH','ISLAND','ISLANDS','MOUNT','MOUNTAIN','CANYON','BEND','LOOP','PASS','TRACE','TURN','RUN','WALK','CROSS','MALL','CENTER','COMMONS','VIA'}:
        streets.append(word)
print(f'Streets Mentioned: {', '.join(streets)}')

#Social Security number
ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
ssn = re.findall(ssn_pattern, doc)
print(f'Social Security numbers found: {', ' .join(ssn)}')

#Ip Address
ip_pattern = r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"
ip = re.findall(ip_pattern, doc)
print(f'IP Addresses found: {', '.join(ip)}')

#Username
for word in words:
    if word.startswith('@'):
        username.append(word)
print(f'Usernames: {', '.join(username)}')

app=Flask(__name__)
app.run(host="127.0.0.1", port=8000)