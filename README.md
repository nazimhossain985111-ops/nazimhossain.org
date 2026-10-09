# nazimhossain.org

নাজিম হোসেনের ব্যক্তিগত ওয়েবসাইট (personal website)। ওয়েবসাইটের লেখা (content) থাকে content ফোল্ডারে, আর build.py সেগুলো থেকে পুরো ওয়েবসাইট তৈরি করে dist ফোল্ডারে।

## কীভাবে প্রকাশ (publish) হয়

এই রিপোজিটরিতে (repository) কোনো পরিবর্তন পুশ (push) করলে ক্লাউডফ্লেয়ার (Cloudflare) নিজে থেকেই ওয়েবসাইট তৈরি (build) করে nazimhossain.org-এ প্রকাশ করে। তৈরির কমান্ড (build command) হলো `pip install -r requirements.txt && python build.py`, আর প্রকাশের কমান্ড (deploy command) হলো `npx wrangler deploy`। ফর্মের ইমেইল যে ঠিকানায় যায়, সেটি ক্লাউডফ্লেয়ারে FORM_TO নামের সিক্রেট (secret) হিসেবে রাখা আছে, কোডে নেই।

## কোথায় কী লিখবেন

সাধারণ পাতাগুলো (pages) আছে content/pages ফোল্ডারে, প্রতিটি পাতা একটি .md ফাইল। নতুন ব্লগ লেখা (blog post) যোগ করতে content/blog ফোল্ডারে একটি নতুন .md ফাইল লিখুন। ফাইলের শুরুতে title, title_en, lang, date ও summary দিতে হয়; নমুনা (example) হিসেবে education-and-democracy.md দেখুন। চলমান প্রকল্পের (ongoing projects) জন্য content/projects ফোল্ডারের _template.md কপি করে নতুন ফাইল লিখুন। ফর্মের অপশনগুলো (form options) আছে content/forms.yaml ফাইলে, আর নাম, মেনু (menu) ও পরিচিতি আছে content/site.yaml ফাইলে।

## নিজের কম্পিউটারে দেখা (preview)

প্রথমবার `pip install -r requirements.txt` চালান। এরপর প্রতিবার `python build.py` চালিয়ে `python -m http.server 8000 --directory dist` দিন, তারপর ব্রাউজারে (browser) http://localhost:8000 খুলুন। নিজের কম্পিউটারে ফর্ম ইমেইল পাঠায় না, কারণ ইমেইল পাঠানোর কাজটি করে worker ফোল্ডারের ক্লাউডফ্লেয়ার ওয়ার্কার (Cloudflare Worker), যা শুধু লাইভ (live) ওয়েবসাইটে চলে।
