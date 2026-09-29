"""Rebuild bundled demo images and SQL. Originals are never modified."""
from pathlib import Path
from PIL import Image, ImageOps
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/images'
files = [SOURCE / name for name in ['0A3404E8-ED8F-4E5A-937A-C4071C6C87BC.png', '16DC569D-C89A-4D0E-83F2-6D688D6998E9.png', '16E12EB6-3244-479C-A036-56A904EB9643.png', '27E221D3-CCFB-4CC1-B837-DD699CA11EB4.png', '4CFA32F6-3C0F-49E6-AC48-36ACCB9074A0.png', '562A9C09-253F-4649-96ED-413268113CD2.png', '71A13A9B-C8E7-4299-9F21-CD0D8C73B4B0.png', '79758B9E-EFCA-4547-ACC5-78CB0A8EC264.png', '7DC18A0A-7C08-4C4F-B3D0-DDF9DC68653A.png', '83E6C0E2-7CF4-4341-81FD-EC789B1ED084.png', '97FE09F8-5204-4523-AC9B-CAAE7F962672.png', 'A480E835-DDC8-4E21-99A7-5E28F869A29E.png', 'B5E3165F-215C-4E59-96DA-1646C513C6F8.png', 'C32F2443-8F56-46CF-99DB-48F561DD6FF4.png', 'C362E703-D476-4D7B-8F40-33A603AE47E9.png', 'C5BE91CC-CA1A-46D3-A989-564D5BAA3BEB.png', 'C6BFAD9B-353A-4471-83A2-07F60ABC5202.png', 'D68479D0-F958-419D-93D7-A5545558D591.png', 'E299DE37-A0BB-4C39-81C8-45455BB90F37.png', 'EAD201A6-5DFB-46A1-A450-987C023D66AD.png', 'IMG_2602.PNG', 'IMG_2605.PNG', 'IMG_5606.PNG', 'IMG_5608.PNG', 'IMG_5610.PNG', 'IMG_5611.PNG', 'IMG_5614.PNG', 'IMG_5617.PNG', 'IMG_5623.PNG', 'IMG_7724.JPG']]
# Photo numbers follow the alphabetically sorted original filenames.
products = [
 ('Midnight Lace Maxi','full-length','Black',3450,[1],False),
 ('Blue Bloom Maxi','full-length','Blue',3250,[2],False),
 ('Noir Slit Dress','full-length','Black',3650,[3],False),
 ('Lace Panel Midi','mid-length','Black',2950,[4,18],False),
 ('Ruby Evening Midi','mid-length','Burgundy',2850,[5],False),
 ('Crimson Occasion Gown','pre-order','Burgundy',0,[6,27],True),
 ('Pink Haze Dress','mid-length','Pink',2750,[7],False),
 ('Blue Sky Shirt','shirt','Blue',1650,[8],False),
 ('Plum Lace Maxi','full-length','Purple',3350,[9],False),
 ('Scarlet Long Sleeve Dress','full-length','Red',3150,[10],False),
 ('Midnight Sheer Dress','full-length','Black',3550,[20,11],False),
 ('Velvet Hour Midi','mid-length','Burgundy',3250,[12,13],False),
 ('Violet Bloom Dress','mid-length','Purple',2950,[14],False),
 ('Everyday Square Neck Top','tops','Black',1250,[15],False),
 ('Soft Sand Set','co-ord-set','Beige',3450,[16],False),
 ('Mocha Draped Top','tops','Brown',1550,[17],False),
 ('Ruby Drape Midi','mid-length','Burgundy',3150,[19,26],False),
 ('Cloud Zip Top','tops','Ivory',1850,[21],False),
 ('Off Duty Zip Top','tops','Black',1850,[22],False),
 ('Porcelain Print Set','co-ord-set','Blue',3650,[23],False),
 ('Lilac Off Shoulder Dress','mid-length','Purple',2850,[24],False),
 ('Twilight Occasion Dress','pre-order','Purple',0,[25],True),
 ('Noir Ruffle Mini','short-length','Black',2450,[28],False),
 ('Coastal Bloom Dress','mid-length','Blue',2650,[29],False),
 ('Rose Garden Dress','mid-length','Pink',2750,[30],False),
]
out=SOURCE/'catalog'; out.mkdir(exist_ok=True)
def sql(value):
 if value is None: return 'NULL'
 if isinstance(value,(int,float)): return str(value)
 return "'"+str(value).replace("'","''")+"'"
def insert(table, row):
 return 'INSERT OR IGNORE INTO '+table+' ('+', '.join(row)+') VALUES ('+', '.join(sql(v) for v in row.values())+');'
statements=['-- Local demo catalogue. Reruns preserve edits and stock. No customer or staff records.']
manifest=[]
for index,(name,category,color,price,photos,preorder) in enumerate(products):
 slug=name.lower().replace(' ','-'); pid='sample-'+slug
 cat={'co-ord-set':'cat-coord','pre-order':'cat-preorder'}.get(category,'cat-'+category)
 stock=0 if preorder or index==8 else 9
 description='Sample catalogue item: '+name+'. Prices, sizing and stock are illustrative; confirm product details before launch.'
 statements.append(insert('products',dict(id=pid,name=name,slug=slug,description=description,long_description=description,category_id=cat,price_in_cents=price*100,currency='BDT',stock=stock,publication_state='published',preorder=int(preorder),is_active=1,featured_position=index,tags_json=json.dumps(['sample','occasion' if 'Dress' in name or 'Gown' in name else 'everyday']),badge='Direct inbox' if preorder else 'New',shipping_note='Sample listing. Delivery charges are shown at checkout.')))
 for v,size in enumerate(['S','M','L']):
  vid=pid+'-'+size.lower(); units=stock//3
  statements.append(insert('product_variants',dict(id=vid,product_id=pid,sku='SAMPLE-'+str(index+1).zfill(2)+'-'+size,size=size,color=color,price_in_cents=price*100,compare_price_in_cents=(price+500)*100 if index%4==0 and price else None,stock_on_hand=units)))
  if units: statements.append(insert('inventory_events',dict(id='initial-'+vid,variant_id=vid,event_type='initial_stock',quantity_delta=units,reason='Local sample catalogue',actor_id='demo-seed')))
 images=[]
 for order,number in enumerate(photos):
  source=files[number-1]; key='catalog/'+slug+'-'+str(order+1)+'.webp'; image=ImageOps.exif_transpose(Image.open(source)).convert('RGB'); image.thumbnail((1200,1500)); image.save(SOURCE/key,'WEBP',quality=82)
  mid='sample-media-'+slug+'-'+str(order+1)
  statements.append(insert('media',dict(id=mid,object_key=key,width=image.width,height=image.height,mime_type='image/webp',alt_text=name+' in '+color.lower()+', view '+str(order+1),status='ready')))
  statements.append(insert('product_images',dict(id=mid+'-link',product_id=pid,media_id=mid,sort_order=order,is_cover=int(order==0))))
  images.append(dict(original=source.name,path='/images/'+key))
 manifest.append(dict(id=pid,name=name,category=category,images=images))
for position,(slug,name,indices) in enumerate([('occasion-edit','The occasion edit',[2,3,4,5,10,11,16]),('everyday-edit','Everyday favourites',[7,13,14,15,17,18,19]),('soft-colour-edit','In full bloom',[1,6,12,20,23,24])]):
 cid='sample-'+slug
 statements.append(insert('collections',dict(id=cid,name=name,slug=slug,description='A curated sample edit. Product details are illustrative.',visibility='published',position=position,hero_image_url=manifest[indices[0]]['images'][0]['path'])))
 for position,i in enumerate(indices): statements.append(insert('collection_products',dict(collection_id=cid,product_id=manifest[i]['id'],position=position)))
settings={
 'heroSlides':[dict(eyebrow='The occasion edit',title='A little drama.',accent='All you.',body='Discover evening silhouettes, soft florals and everyday favourites. Find your next favourite piece.',label="The Diva's Drip / The new edit",imageUrl=manifest[1]['images'][0]['path'],href='/collection/occasion-edit')],
 'categoryTiles':[dict(label=label,href='/shop?category='+cat,imageUrl=manifest[i]['images'][0]['path'],tone=tone) for label,cat,i,tone in [('Dresses','dress',23,'rose'),('Co-ord sets','co-ord-set',14,'sand'),('Tops','tops',15,'sage'),('Pre-order','pre-order',5,'lavender')]],
 'featuredProductIds':[manifest[i]['id'] for i in [1,3,14,24]],
}
for key,value in settings.items(): statements.append(insert('settings',dict(key=key,value_json=json.dumps(value),updated_by='demo-seed')))
(ROOT/'db/demo-seed.sql').write_text('\n'.join(statements)+'\n',encoding='utf-8')
(ROOT/'db/demo-catalogue.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f'Prepared {len(products)} products, 75 variants, 30 photos and 3 collections.')
