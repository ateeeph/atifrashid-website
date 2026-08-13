# Atif Rashid website

## Project overview
This project is a lightweight static website for Atif Rashid that displays curated LinkedIn posts. It uses HTML, CSS, vanilla JavaScript, JSON, and Pages CMS configuration only.

## Folder structure
- index.html — main landing page
- 404.html — custom not-found page
- .pages.yml — Pages CMS configuration
- _headers — Cloudflare Pages security headers
- robots.txt — basic robots instructions
- sitemap.xml — sitemap for the site
- favicon.png — favicon
- assets/css/style.css — site styles
- assets/js/app.js — post fetching, rendering, search, filtering, and states
- data/posts.json — post data source

## Preview locally
Run:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## Replace the introduction
Edit the intro copy in index.html in the header section.

## Update the LinkedIn profile URL
Update the two LinkedIn links in index.html and the footer link if needed.

## How posts.json works
The site reads posts from data/posts.json. Each record should include:
- id
- title
- url
- date
- description
- image (optional)
- full_description (optional, rich text/HTML)
- category or categories
- featured

Clicking a post title on the homepage opens post.html?id=<id>, a single static
detail page that reads the matching record from data/posts.json client-side.

## How Pages CMS works
Pages CMS is configured in .pages.yml and points to data/posts.json so authorized GitHub users can manage the posts array directly.

## Connect the repository to Pages CMS
Connect your GitHub repository to Pages CMS and select the repository and branch you want to manage.

## Add, edit, and delete posts through Pages CMS
Open the Pages CMS interface for this repository and manage the posts collection. You can add, edit, delete, rename, change the URL, set the date, edit the description, choose a category, and mark a post as featured.

## Deploy the main branch to Cloudflare Pages
In Cloudflare Pages, create a new project from the GitHub repository and deploy the main branch. Use the default static settings with no build step.

## Cloudflare configuration for a static project with no build step
Set the project to use the repository root as the publish directory and leave the build command empty.

## Test the temporary pages.dev URL
After the first deployment, test the temporary Cloudflare Pages URL and verify that the website loads correctly.

## Connect atifrashid.com
Once the site is working on the temporary URL, configure the custom domain atifrashid.com in Cloudflare Pages.

## Configure www.atifrashid.com to redirect to atifrashid.com
Create a redirect rule or DNS record so www.atifrashid.com points to atifrashid.com.

## Preserve DNS and email records
Before changing DNS, preserve any existing records so email and other services continue to work.

## Never commit credentials or tokens
Keep all secrets out of the repository and never commit credentials, tokens, or private keys.

## Replace the blank date of the initial test post
Edit the date field in data/posts.json for the initial test post to a real date string when one becomes available.
