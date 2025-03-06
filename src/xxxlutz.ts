import {DocumentProcessorServiceClient} from "@google-cloud/documentai";

const client = new DocumentProcessorServiceClient({keyFilename:"../chrome-lunch-extension-6c9cb40592f6.json",
	 apiEndpoint: 'eu-documentai.googleapis.com'
});

const xxxLutz = async () =>{
	const name = `projects/440110053438/locations/eu/processors/86285dbe739309e2`;

	const pdfUrl = "https://www.giorno.sk/wp-content/uploads/2025/02/Menu-Giorno-3.pdf";
	const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Failed to fetch PDF. Status: ${response.status}`);
    const pdfFile = await response.arrayBuffer();

	const encodedPdf = Buffer.from(pdfFile).toString('base64');

	const request = {
		name,
		rawDocument: {
		  content: encodedPdf,
		  mimeType: 'application/pdf',
		},
	  };

	const [result] = await client.processDocument(request);
  	const {document} = result;

	console.log(document);

}

xxxLutz();