import puppeteer from "puppeteer";

const converter = (day:string | null | undefined) =>{
	if(day?.includes("Pondelok")) return "monday";
	if(day?.includes("Utorok")) return "tuesday";
	if(day?.includes("Streda")) return "wednesday";
	if(day?.includes("Štvrtok")) return "thursday";
	if(day?.includes("Piatok")) return "friday";
	return day
}

const mediCullina = async () =>{
	try {
		const url = "https://menucka.sk/denne-menu/bratislava/mediculina-galvaniho-17-a";
		const browser = await puppeteer.launch({
		  headless: true,
		  args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
	
		const page = await browser.newPage();
		await page.goto(url, { waitUntil: "networkidle2" });
	
		const paragraphs = await page.$$(".day-title p");
		const meals = await page.$$(".col-xs-10.col-sm-10");

		const removeIndex:number[] = [];

		const mealsMenu = (await Promise.all(meals
			.map(async (meal) => {
				const text = await page.evaluate(el => el.textContent, meal)
				return text?.replaceAll(/\s+/g, ' ')
			})))
			.filter((text) =>{
				return text?.trim() !== ""
			});

		const overenaKlasika = mealsMenu.filter((text)=>{const res = text?.split(":");return (res === undefined || res[0] !== "Overená klasika")}).map((_,i)=>i)
		const prices = (await Promise.all((await page.$$(".col-xs-2.col-sm-2.price")).map(async price => page.evaluate(el => el.textContent,price)))).filter((price)=>  price?.trim() !== "" ).filter((_,index)=>(index in overenaKlasika));
		
		const days = (await Promise.all(paragraphs.map(async paragraph => converter(await page.evaluate(el => el.textContent, paragraph))))).filter((x)=>typeof x === "string");

		
	
		
			
		const result = days.reduce((res:{[key:string]:(string|undefined)[]},data,index)=>{
			const mealsPerDay = mealsMenu.length/days.length
			const meals = mealsMenu.slice(index*mealsPerDay,(mealsPerDay*(index+1)));
			const localPrices = prices.slice(index*mealsPerDay,(mealsPerDay*(index+1)))
			res[data] = meals.map((meal,index)=>meal + (localPrices[index] ?? ""));
			return res;
		},{});
		
		console.log(result)
		await page.close();
		await browser.close();
	  } catch (error) {
		console.error("Error occurred while scraping:", error);
	  }
}

const vert = async () => {
		const url = "https://jedalenvert.sk/obedove-menu-vert-aruba-galvaniho";
		const browser = await puppeteer.launch({
		  headless: true,
		  args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
	
		const page = await browser.newPage();
		await page.goto(url, { waitUntil: "networkidle2" });
	
		const div = await page.$$(".aruba-menu-box-day");
		const days = await Promise.all(div.map( async day => await day?.evaluate(el=> el.id)))

		const meals = await Promise.all(div.map(async day => {
			const mealElements = await day.$$(".aruba-meal");
			
			const meals = await Promise.all(mealElements.map(async meal => {
				const mealName = await (await meal.$(".aruba-meal-name"))?.evaluate(el => el.textContent);
				const mealPrice = await (await meal.$(".aruba-meal-price"))?.evaluate(el => el.textContent);
				
				return {
					mealName: mealName?.replaceAll("\n", "").replaceAll("\t", "").replace(/\s+/g, ' ').split(" - obsahuje ")[0].trim(),
					mealPrice: mealPrice?.replaceAll("\n", "").replaceAll("\t", "").trim()
				};
			}));
		
			return meals.filter(meal => meal.mealPrice !== '0,00 €').map(meal => meal.mealName + " " + meal.mealPrice); // Now filtering synchronously
		}));

		const result = days.reduce((res:{[key:string]:string[]},data,index)=>{
			res[data] = meals[index]
			return res;
		},{})

		await page.close();
		await browser.close();

		return result;
}
			

mediCullina()