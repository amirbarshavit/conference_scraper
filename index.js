const axios = require('axios');
const puppeteer = require('puppeteer');
const openai = require('./openai.js');
// const openai = require('./localAI');

const cheerio = require('cheerio');
const { URL } = require('url');
const fs = require('fs');
const local = true

async function createTextFile(data, filename='text') {
    if (filename.includes('/')) {
        filename = filename.replace(/\//g, '_');
    }
    console.log(data)
    const allSpeakers = data.map(item => item.content)
    const content = await  openai.askModel(`Based on the following data list ${allSpeakers.join('\n')} of talks and their speakers, create an array of JSONs in the following format:
    [{
        "speaker": "speaker name",
        "role": "speaker role",
        "talk?": "talk name",
        "talk_summary?": "talk summary",
        "company": "company name"
    }]
    
    IMPORTANT: RETURN Array of JSONs ONLY without any other text
    `,'gpt-4o-mini')
    // const conferenceUrl = 'https://www.haya-data.com/';
    const details = await scrapeConferenceDetails(url);
    console.log("Conference Details:", details);
    console.log(content)
    fs.writeFileSync(`./data/${filename}-speakers.json`,content, 'utf8');
    fs.writeFileSync(`./data/${filename}-details.json`,details, 'utf8');
}

async function fetchHTML(url) {
    const { data } = await axios.get(url);
    return cheerio.load(data);
}
async function fetchText(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' }); // Wait until the network is idle
    await page.screenshot({ path: `screenshot.png`, fullPage: true });

    const content = await page.evaluate(() => document.body.innerText);
    const $ = cheerio.load(content);


    await browser.close();
    return $.text()
}
function isSameSubdomain(base, link) {
    const baseHostname = new URL(base).hostname;
    const linkHostname = new URL(link, base).hostname;
    return baseHostname === linkHostname;
}

// async function scrape(url) {
//     const $ = await fetchHTML(url);
//     const links = [];

//     // Get all links on the first level
//     $('a').each((i, link) => {
//         const href = $(link).attr('href');
//         if (href  && isSameSubdomain(url, href)) {
//             links.push(href);
//         }
//     });

//     console.log(`Links found on ${url}:`, links);

//     const content = await openai.askModel(`Based on the following links, please return a list of links that could contain useful information about conference  Agenda. IMPORTANT RETURN ONLY ARRAY OF LINKS: ${links.join(', ')}`,'gpt-4o')
//     console.log(content)
//     return content
// }

// const url = 'https://pydata.org/telaviv2024'; // Replace with the URL you want to scrape
// const domain = 'https://pydata.org'

// const url = 'https://www.haya-data.com'; // Replace with the URL you want to scrape
// const domain = 'https://www.haya-data.com'

// const url = 'https://widstlv.com'; // Replace with the URL you want to scrape
// const domain = 'https://widstlv.com'

// const url = 'https://aidevtlv.com'; // Replace with the URL you want to scrape
// const domain = 'https://aidevtlv.com'

// const url = 'https://conf.react.dev/'; // Replace with the URL you want to scrape
// const domain = 'https://conf.react.dev/'

const url = 'https://reactnexus.com/'; // Replace with the URL you want to scrape
const domain = 'https://reactnexus.com/'

const conferenceUrl = url


async function scrapeConferenceDetails(conferenceUrl) {
    const $ = await fetchHTML(conferenceUrl);
    const content = await fetchText(conferenceUrl);

    const details = await openai.askModel(
        `Based on the following data, please provide details about the conference such as the location, date, and sponsors: ${content}
        Return The details in JSON format with the following fields: location, date, sponsors WITHOUT any other text`,
        'gpt-4o'
    );

    console.log(`Conference details for ${conferenceUrl}:`, details);
    return details;
}


async function getLinks(url,prompt = "Based on the following links, please return a list of links that could contain useful information about conference  Agenda.") {
    const $ = await fetchHTML(url);
    const links = [];

    // Get all links on the first level
    $('a').each((i, link) => {
        const href = $(link).attr('href');
        if (href  && isSameSubdomain(url, href)) {
            links.push(href);
        }
    });
    const uniqueLinks = [...new Set(links)];
    links.length = 0;
    links.push(...uniqueLinks);
    console.log(`Links found on ${url}:`, links);

    const content = await openai.askModel(`${prompt} IMPORTANT RETURN ONLY ARRAY OF LINKS WITHOUT ANY OTHER TEXT: ${links.join(', ')}`,'gpt-4o')
    console.log(content)
    return content
}

const scrapeDataFromLinks = async (links,prompt='return a list of all the talks and their speakers')=>{
    console.log(links)  
    let res = []
    links = JSON.parse(links)
    for (const link of links) {
        let fullLink = link
        if(!link.includes(domain)){
            fullLink = domain + link
        }
    const data = await fetchText(fullLink)
    const content = await openai.askModel(`Based on the following data :${data} ${prompt}`,'gpt-4o-mini')
        res.push({content:content,url:fullLink})
    console.log("--------------------------------")
    }
    return res

}

const saveToFile = async (data)=>{
    console.log("================================================")
    await createTextFile(data, domain.split('://')[1])
    console.log("================================================")
}
const run = async () =>{
    const links = await getLinks(conferenceUrl)
    const data = await scrapeDataFromLinks(links)
    await saveToFile(data)
}

run()