import { MongoDatabase } from '../../../database/mongo';

export class StatusReport {
    public async run(): Promise<void> {
        const mongo = MongoDatabase.getInstance();
        await mongo.connect();

        try {
            const bronzeUrls = await mongo.getCollection('bronze/dailydose_ds.urls');
            const bronzeHtml = await mongo.getCollection('bronze/dailydose_ds.html');
            const silverHtml = await mongo.getCollection('silver/dailydose_ds.html');

            const totalUrls = await bronzeUrls.countDocuments();
            const totalBronze = await bronzeHtml.countDocuments();
            const totalSilver = await silverHtml.countDocuments();

            console.log('\n=========================================================================');
            console.log('📊 [Daily Dose DS] Collection Status Report');
            console.log('=========================================================================');
            console.log(`- Total URLs (Bronze): ${totalUrls}`);
            console.log(`- Total HTMLs (Bronze): ${totalBronze}`);
            console.log(`- Total Markdown (Silver): ${totalSilver}`);
            console.log('-------------------------------------------------------------------------');
            
            const missing = totalUrls - totalBronze;
            const pending = totalBronze - totalSilver;

            console.log(`- Pending HTML Collection: ${missing} items`);
            console.log(`- Pending Transformation: ${pending} items`);
            
            const progress = totalUrls > 0 ? ((totalSilver / totalUrls) * 100).toFixed(2) : '0.00';
            console.log(`- Overall Progress: ${progress}%`);
            console.log('=========================================================================');
        } catch (err: any) {
            console.error(`❌ Error generating status report: ${err.message}`);
        } finally {
            await mongo.close();
            process.exit(0);
        }
    }
}

if (require.main === module) {
    const report = new StatusReport();
    report.run().catch(console.error);
}
