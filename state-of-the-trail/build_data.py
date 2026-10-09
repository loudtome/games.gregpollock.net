"""Derive State from Chamber and build the offline browser dataset."""
import csv, json, re
from urllib.parse import urlparse, unquote
from pathlib import Path
ROOT = Path(__file__).resolve().parent
NAMES = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'
names = dict(x.split(':') for x in NAMES.split('|'))
p = ROOT / 'Grid view.csv'
with p.open(encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f); fields = list(reader.fieldnames); rows = list(reader)
if 'State' not in fields: fields.insert(fields.index('Chamber') + 1, 'State')
bills = []
for row in rows:
    code = row['Chamber'].split()[0]
    assert code in names, row
    row['State'] = names[code]
    match = re.search(r'legiscan.com/([A-Z]{2})/[^/]+/([^/]+)', row['Bill (URL)'], re.I)
    if match: assert match[1].upper() == code, row
    else:
        host = urlparse(row['Bill (URL)']).netloc
        expected = {'malegislature.gov':'MA','capitol.texas.gov':'TX','www.scstatehouse.gov':'SC','wapp.capitol.tn.gov':'TN','www.senate.mo.gov':'MO','documents.house.mo.gov':'MO','house.mo.gov':'MO','www.azleg.gov':'AZ','lis.virginia.gov':'VA','www.mainelegislature.org':'ME','apps.legislature.ky.gov':'KY','www.wyoleg.gov':'WY','webserver1.lsb.state.ok.us':'OK','www.akleg.gov':'AK','www.flsenate.gov':'FL','arkleg.state.ar.us':'AR','www.ohiohouse.gov':'OH','www.oklegislature.gov':'OK'}
        assert expected.get(host) == code, row
    identifier = re.search(r'(?:HB|SB|HCR|SCR|HJR|SJR|HD|SD)\d+', unquote(row['Bill (URL)']), re.I)
    description = row.get('Encounter Description', '').strip()
    assert description, f"Missing Encounter Description for {code}: {row['Summary']}"
    effect = row.get('Encounter Effect', '').strip()
    assert effect in ('one', 'all', 'delay'), f"Encounter Effect must be one, all, or delay for {code}: {row['Summary']}"
    assert ('{name}' in description) == (effect == 'one'), f"Use {{name}} exactly when Encounter Effect is 'one' for {code}: {row['Summary']}"
    bills.append(dict(state=code, description=description, effect=effect, summary=row['Summary'], category=row['Issue Category'], chamber=row['Chamber'], sponsor=row['Sponsor'], url=row['Bill (URL)'], bill=match[2].upper() if match else identifier[0].upper() if identifier else 'Proposal'))
with p.open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fields); writer.writeheader(); writer.writerows(rows)
(ROOT / 'data' / 'bills.json').write_text(json.dumps(dict(names=names,bills=bills),ensure_ascii=False))
print(f'Mapped and exported {len(rows)} entries; every recognized bill URL agrees with its chamber state.')
