import { giorno, xxxLutz } from "./documentAi";
import { mediCullina, vert } from "./scrape";
import { Firestore } from "@google-cloud/firestore";

interface Data {
	[key:string]:{[key:string]:string[]} | null;
}

const getMenus= async () => {
	const db = new Firestore({
		databaseId:process.env.GOOGLE_DATABASE_ID!,
		projectId: process.env.GOOGLE_PROJECT_ID!,
		keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS!,
	});

	const data:Data = {
		mediCullina: null,
		vert: null,
		giorno: null,
		xxxLutz: null,
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

	console.log(data);

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