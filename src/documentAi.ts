import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { MenuItem, puppeteerConfig, SingleMenu } from ".";

puppeteer.use(StealthPlugin());

const client = new DocumentProcessorServiceClient({
	keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
	apiEndpoint: "eu-documentai.googleapis.com",
});

function normalizeUTCDate(date:Date) {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
}

function getFirstUTCMondayOfMonth(year:number, month:number) {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const offset = (1 - firstDay.getUTCDay() + 7) % 7; // Days to first Monday
    const firstMonday = new Date(firstDay);
    firstMonday.setUTCDate(firstDay.getUTCDate() + offset);
    return normalizeUTCDate(firstMonday);
}

function getLatestMondayOrder(inputDate = new Date()) {
    const now = normalizeUTCDate(inputDate);
    let lastMonday = normalizeUTCDate(new Date(now));
    lastMonday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));

    // Determine the target month/year of the last Monday
    const targetYear = lastMonday.getUTCFullYear();
    const targetMonth = lastMonday.getUTCMonth();

    // Calculate the first Monday of the target month
    const firstMonday = getFirstUTCMondayOfMonth(targetYear, targetMonth);

    // Compute the ordinal position (1-based)
    const timeDiff = lastMonday.getTime() - firstMonday.getTime();
    const order = Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000)) + 1;

    return { order, month: targetMonth + 1, year: targetYear };
}

const giorno = async () => {
	const name =
		`projects/${process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID}/locations/eu/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_GIORNO_ID}`;

		const monday = getLatestMondayOrder()
	const pdfUrl =
		`https://www.giorno.sk/wp-content/uploads/${monday.year}/${monday.month.toString().padStart(2, '0')}/${monday.order > 1 ? `Menu-Giorno-${monday.order-1}` : "Menu-Giorno"}.pdf`;
	const response = await fetch(pdfUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch PDF. Status: ${response.status}`);
	}
	const pdfFile = await response.arrayBuffer();

	const encodedPdf = Buffer.from(pdfFile).toString("base64");

	const request = {
		name,
		rawDocument: {
			content: encodedPdf,
			mimeType: "application/pdf",
		},
	};

	const [result] = await client.processDocument(request);
	const { document } = result;

	const finalResult =
		document?.entities?.reduce((res: { [key: string]: MenuItem[] } | null, data) => {
			const strings = data?.type?.split("_");
			if (!strings || strings.length === 0) {
				throw new Error("No data type found");
			}

			if (res && (!res[strings[0]])) { // Fix: Check if it exists before assigning an array
				res[strings[0]] = [];
			}

			// console.log(strings[0]);
			let text = data?.mentionText ?? "";
			text = text.replace("0,331", "0,33l").replaceAll("\n", " ")
			
			const match = text.match(/^([0-9,]+([lg]))\s+(.*?)(?:\s*\/\d+,\d+\/\s*)?(\d+,\d+€)?$/)

			if (!match) return null;
    

			res && res[strings[0]].push(
				{
					type: match[2] == 'g' ? 'menu' : 'soup', // 'l' or 'g' from the quantity unit
					name: match[3].trim(), // name part, trimmed to remove any extra spaces
					quantity: match[1], // full quantity including unit
					price: match[4] || undefined // price if present, otherwise undefined
				}
			);

			return res;
		}, {}) || {}; // Ensure `finalResult` is always an object

	return finalResult;
};

const xxxLutz = async () => {
	const url = "https://www.xxxlutz.sk/c/xxxl-restauracia";
	const browser = await puppeteer.launch(puppeteerConfig);
	const page = await browser.newPage();

	await page.goto(url, { waitUntil: "networkidle2" });

	const menuJpg =
		await (await page.$("._e7JRcAGv2ffcDMwg[title='Bratislava']"))
			?.evaluate((el) => (el as HTMLAnchorElement).href, page);

	await page.close();
	await browser.close();

	const name =
		`projects/${process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID}/locations/eu/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_XXXLUTZ_ID}`;
	if (!menuJpg) throw new Error("Menu link not found");
	const response = await fetch(menuJpg);
	if (!response.ok) {
		throw new Error(`Failed to fetch JPG. Status: ${response.status}`);
	}
	const jpgFile = await response.arrayBuffer();

	const encodedJpg = Buffer.from(jpgFile).toString("base64");

	const request = {
		name,
		rawDocument: {
			content: encodedJpg,
			mimeType: "image/jpeg",
		},
	};

	const [result] = await client.processDocument(request);
	const { document } = result;

	const finalResult =
		document?.entities?.reduce((res: { [key: string]: SingleMenu }|null, data) => {
			const strings = data?.type?.split("_");
			if (!strings || strings.length === 0) {
				throw new Error("No data type found");
			}

			if (res && (!res[strings[0]])) { // Fix: Check if it exists before assigning an array
				res[strings[0]] = {mainMeal: "", soup: "", price: ""};
			}

			// console.log(strings[0]);
			let text = data?.mentionText ?? "";
			text = text.replace("0,21", "0,2l").replaceAll("\n", " ")

			if (res && /\d+[,.]?\d*\s*g/.test(text)) {
				res[strings[0]].mainMeal = text;
			  }
			  // Check for soup (contains "l" in quantity)
			  else if (res && /\d+[,.]?\d*\s*l/.test(text)) {
				res[strings[0]].soup =text;
			  }
			  // Check for price (only numbers, optional comma, and optional "€")
			  else if (res && /^\d+,\d+\s*€?$/.test(text)) {
				res[strings[0]].price=text.replace(/\s*€/, '') + " €"; // Remove "€" if present
			  }

			return res;
		}, {}) || {};

	return finalResult;
};

export { giorno, xxxLutz };
