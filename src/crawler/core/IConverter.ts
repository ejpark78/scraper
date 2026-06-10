export interface IConverter<T> {
    /**
     * HTML 내용을 파싱하여 특정 메타데이터 오브젝트 T를 생성합니다.
     */
    convertHtmlToMarkdown(htmlContent: string, id: string, url: string): Promise<T>;

    /**
     * 최종 마크다운을 Prettify하여 출력 경로에 저장합니다.
     */
    prettifyAndSave(rawText: string, outputPath: string): Promise<void>;
}
