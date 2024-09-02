const axios = require('axios');
const puppeteer = require('puppeteer');
const openai = require('./openai.js');
const cheerio = require('cheerio');
const { URL } = require('url');
const fs = require('fs');

// const url = 'https://reactnexus.com/';
// const domain = 'https://reactnexus.com/';
const url = 'https://tedai-vienna.ted.com/';
const domain = 'https://tedai-vienna.ted.com/';

async function createTextFile(data, filename = 'text') {
    filename = filename.replace(/\//g, '_');
    console.log(data);

    const allSpeakers = data.map(item => item.content);
    const content = await openai.askModel(
        `Based on the following data list ${allSpeakers.join('\n')} of talks and their speakers, create an array of JSONs in the following format:
        [{
            "speaker": "speaker name",
            "role": "speaker role",
            "talk?": "talk name",
            "talk_summary?": "talk summary",
            "company": "company name"
        }]
        IMPORTANT: RETURN Array of JSONs ONLY without any other text`,
        'gpt-4o-mini'
    );

    const details = await scrapeConferenceDetails(url);
    console.log("Conference Details:", details);
    console.log(content);

    fs.writeFileSync(`./data/${filename}-speakers.json`, content, 'utf8');
    fs.writeFileSync(`./data/${filename}-details.json`, details, 'utf8');
}

async function fetchHTML(url) {
    const { data } = await axios.get(url);
    return cheerio.load(data);
}

async function fetchText(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: `screenshot.png`, fullPage: true });

    const content = await page.evaluate(() => document.body.innerText);
    await browser.close();
    return cheerio.load(content).text();
}

function isSameSubdomain(base, link) {
    const baseHostname = new URL(base).hostname;
    const linkHostname = new URL(link, base).hostname;
    return baseHostname === linkHostname;
}

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

async function getLinks(url, prompt = "Based on the following links, please return a list of links that could contain useful information about conference Agenda.") {
    const $ = await fetchHTML(url);
    const links = [];

    $('a').each((i, link) => {
        const href = $(link).attr('href');
        if (href && isSameSubdomain(url, href)) {
            links.push(href);
        }
    });

    const uniqueLinks = [...new Set(links)];
    console.log(`Links found on ${url}:`, uniqueLinks);

    const content = await openai.askModel(`${prompt} IMPORTANT RETURN ONLY ARRAY OF LINKS WITHOUT ANY OTHER TEXT: ${uniqueLinks.join(', ')}`, 'gpt-4o');
    console.log(content);
    return content;
}

async function scrapeDataFromLinks(links, prompt = 'return a list of all the talks and their speakers') {
    console.log(links);
    let res = [];
    links = JSON.parse(links);

    for (const link of links) {
        const fullLink = link.includes(domain) ? link : domain + link;
        const data = await fetchText(fullLink);
        const content = await openai.askModel(`Based on the following data: ${data} ${prompt}`, 'gpt-4o-mini');
        res.push({ content, url: fullLink });
        console.log("--------------------------------");
    }

    return res;
}

async function saveToFile(data) {
    console.log("================================================");
    await createTextFile(data, domain.split('://')[1]);
    console.log("================================================");
}

async function run() {
    try {
        const links = await getLinks(url);
        const data = await scrapeDataFromLinks(links);
        await saveToFile(data);
    } catch (error) {
        console.error("Error during scraping process:", error);
    }
}

run();