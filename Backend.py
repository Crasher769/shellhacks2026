import re

while True:

    doc = input("Paste doc: ").upper()
    print(doc)
    words = doc.split()
    address_pos = 0
    email = []
    streets = []

    #Phone number
    phone_pattern = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    phone = re.findall(phone_pattern, doc)
    print(f'Phone numbers found: {', ' .join(phone)}')

    #Email
    for word in words:
        if '@' in word and '.' in word:
            email.append(word)
    print(f'Emails found: {', ' .join(email)}')

    #address
    for word in words:
        if word.upper() in {'ST','AVE','BLVD','RD','DR','LN','CT','CIR','PKWY','HWY','PL','TER','TRL','WAY','APT','STE','BLDG','FL','STREET','AVENUE','ROAD','BOULEVARD','DRIVE','LANE','COURT','CIRCLE','PARKWAY','HIGHWAY','PLACE','TERRACE','TRAIL','APARTMENT','SUITE','BUILDING','FLOOR','CITY','TOWN','VILLAGE','COUNTY','STATE','HEIGHTS','HILLS','JUNCTION','VALLEY','MANOR','MEADOW','PINES','GROVE','PARK','PLAZA','SQUARE','COVE','CROSSING','ESTATES','LANDING','POINT','RIDGE','VIEW','VISTA','GARDENS','SPRINGS','CREEK','LAKE','LAKES','BEACH','ISLAND','ISLANDS','MOUNT','MOUNTAIN','CANYON','BEND','LOOP','PASS','TRACE','TURN','RUN','WALK','CROSS','MALL','CENTER','COMMONS','VIA'}:            streets.append(word)
    print(f'Streets Mentioned: {', '.join(streets)}')

    #Social Security number
    ssn_pattern = r'\d{3}-\d{2}-\d{4}'
    ssn = re.findall(phone_pattern, doc)
    print(f'Social Security numbers found: {', ' .join(ssn)}')
