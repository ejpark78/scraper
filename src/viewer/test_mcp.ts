import { MongoDatabase } from '../database/mongo';

async function test() {
  const mongo = MongoDatabase.getInstance();
  const db = await mongo.connect();
  const silverColl = db.collection('linkedin.jobs');
  
  const query = {
    $and: [
      { $or: [ { location: /UAE/i }, { location: /United Arab Emirates/i } ] },
      { $or: [ { title: /MLOps/i }, { title: /Machine Learning/i }, { description: /MLOps/i } ] }
    ]
  };
  
  const docs = await silverColl.find(query)
    .sort({ _id: -1 })
    .limit(10)
    .toArray();
    
  console.log(JSON.stringify({
    jsonrpc: "2.0",
    result: {
      content: [
        {
          type: "text",
          text: docs.map(doc => {
            return `### Title: ${doc.title || doc.jobTitle}\nCompany: ${doc.companyName}\nLocation: ${doc.location}\nURL: ${doc.url || 'No URL'}\nID: ${doc.jobId}\n---\n${(doc.description || '').substring(0, 500)}...\n\n`;
          }).join('\n')
        }
      ]
    }
  }, null, 2));
  
  await mongo.close();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
