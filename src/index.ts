import "dotenv/config";
import { giorno, xxxLutz } from "./documentAi";
import { mediCullina, takeoff, vert } from "./scrape";
import { Firestore } from "@google-cloud/firestore";

export const puppeteerConfig = {
	 headless: true,
	 args: ["--no-sandbox", "--disable-setuid-sandbox"],
	...(process.env.SHELL == '/bin/bash' && {executablePath: '/usr/bin/chromium'})
}

export interface MenuItem {
	type: string;
	name: string;
	quantity: string;
	price?: string;
}

export interface SingleMenu {
	mainMeal:string;
	soup: string,
	price:string,
}

interface Data {
	[key:string]:{[key:string]:MenuItem[] | SingleMenu} | null;
}

const converter = (day: string) => {
	if (day?.includes("pondelok")) return "monday";
	if (day?.includes("utorok")) return "tuesday";
	if (day?.includes("streda")) return "wednesday";
	if (day?.includes("tvrtok")) return "thursday";
	if (day?.includes("piatok")) return "friday";
	return day;
};

export const intoMap = (array:string[][],callback:(item:string)=>MenuItem|null) =>{
	const obj:{[key: string]: MenuItem[]} = {};
	for (const item of array) {
		const rawDay = item.shift()?.toLowerCase();
		const day = converter(rawDay ?? "other");
		if(callback){
			obj[day]= item.map(callback).filter((x) => x !== null);
		}
	}
	return obj
}

const getMenus= async () => {
	const db = new Firestore({
		databaseId:process.env.GOOGLE_DATABASE_ID!,
		projectId: process.env.GOOGLE_PROJECT_ID!,
		keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS!,
		ignoreUndefinedProperties:true
	});

	const data:Data = {
		mediCullina: null,
		vert: null,
		giorno: null,
		xxxLutz: null,
		takeoff: null
	};

	try {
		 data.mediCullina = await mediCullina();
		 console.log("[MEDICULLINA] DONE");
	} catch (e) {
		console.log("[MEDICULLINA] ERROR: " + e);
	}

	try {
		data.vert = await vert();
		console.log("[VERT] DONE");
	} catch (e) {
		console.log("[VERT] ERROR: " + e);
	}
	
	try {
		data.giorno = await giorno();
		console.log("[GIORNO] DONE");
	} catch (e) {
		console.log("[GIORNO] ERROR: " + e);
	}

	try {
		data.xxxLutz = await xxxLutz();
		console.log("[XXXLUTZ] DONE");
	} catch (e) {
		console.log("[XXXLUTZ] ERROR: " + e);
	}

	try {
		data.takeoff = await takeoff();
		console.log("[TAKEOFF] DONE");
	} catch (e) {
		console.log("[TAKEOFF] ERROR: " + e);
	}

	console.log(JSON.stringify(data));

	try {
		if(Object.entries(data).every((x)=>x === null)) throw new Error("No Data to send into Database");
		await db.collection("lunch-menus").doc("week_menus").set(data);
		console.log("[FIRESTORE] DONE");
	} catch (e) {
		console.log("[FIRESTORE] ERROR: " + e);
	}
};
console.log("Started");
if(process.env.GOOGLE_APPLICATION_CREDENTIALS === undefined || process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_GIORNO_ID === undefined || process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_XXXLUTZ_ID === undefined) throw new Error("Google credentials is not defined");
getMenus();