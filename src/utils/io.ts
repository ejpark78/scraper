import * as fs from 'fs';
import * as path from 'path';

export class IOUtils {
    /**
     * 📂 특정 디렉토리 하위의 특정 확장자 파일 목록을 재귀적으로 수집하는 고성능 정적 헬퍼
     */
    public static getAllFiles(dir: string, extension: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.getAllFiles(fullPath, extension));
            } else if (file.endsWith(extension)) {
                results.push(fullPath);
            }
        });
        return results;
    }
}
