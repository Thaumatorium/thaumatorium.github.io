# Thaumatorium.com

## Introduction

The website is all handwritten HTML, CSS and JS.

Anything else is bloat, really (unless browser creators finally replace JS, but that's not going to happen...)

## Documentation

["You might not need jQuery"](http://youmightnotneedjquery.com/) - A great resource if you want to stop using jQuery (\*cough\* *bloat)*

### Recommended IDE

[vscode](https://code.visualstudio.com/ "visual studio code")

### Extensions

I've added an `extensions.json` file, which once you open the project in vscode, a popup will ask you to install **recommended extensions**.

This enables beginners to start faster (not to mention get informed on interesting addons like [TabNine](https://marketplace.visualstudio.com/items?itemName=TabNine.tabnine-vscode) for example).

### Languages used

* [HTML 5.2](https://html.spec.whatwg.org/dev/)
* [CSS 3](https://www.w3.org/TR/css-2018/#css)
* [JavaScript](https://eloquentjavascript.net/)

## File notes

In alphabetical order.

### 404.html

You'll only see this one once you go to a URL that doesn't exist.
The reason why this 404 page is superior to others is that mine has an archival service \*and\* a site-search built-in.

### CNAME

Exists for hosting purposes. Redirects thaumatorium.github.io to thaumatorium.com.

### index.html

The frontpage of the site. The only file with a ton of comments, explaining why the HTML structure is the way it is.

### manifest.json

Contains information for sites that want to become a Progressive Web App - I used to have this funcitonality, but had to remove this functionality because it broke updating the site.
Only works on Chromium based browsers as of writing.

*Information source*:
https://www.w3.org/TR/appmanifest/
https://w3c.github.io/manifest/

*Support level:*
[https://caniuse.com/#feat=web-app-manifest](https://caniuse.com/#feat=web-app-manifest)

### PWA.js

This used to startup the PWA functionality of the site, but now it functions as general holder of code, as every HTML page contains a link to this file.

### robots.txt

A file that tells crawlers/bots what they can and can't access (currently they're allowed to crawl everything).
Of course crawlers could just ignore this file, but the big ones (GoogleBot, Bingbot, DuckDuckBot, etc) honor this file.

## Financial Support

See the sidebar!
