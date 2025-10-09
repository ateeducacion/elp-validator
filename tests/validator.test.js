const {
    parseContentXml,
    checkRootElement,
    checkNavStructures,
    checkPagePresence,
    validateStructuralIntegrity,
    extractResourcePaths,
    findMissingResources,
    normalizeResourcePath
} = require('../js/validator');

describe('ELP Validator helpers', () => {
    const minimalXml = `<?xml version="1.0"?>
    <ode>
        <odeNavStructures>
            <odeNavStructure>
                <odePageId>p1</odePageId>
                <pageName>Start</pageName>
                <odeNavStructureSyncOrder>1</odeNavStructureSyncOrder>
                <odePagStructures>
                    <odePagStructure>
                        <odeBlockId>b1</odeBlockId>
                        <blockName>Block</blockName>
                        <odeComponents>
                            <odeComponent>
                                <odeIdeviceId>c1</odeIdeviceId>
                                <odeIdeviceTypeName>TextIdevice</odeIdeviceTypeName>
                                <htmlView><![CDATA[<p>Content with <img src="content/images/pic.png"></p>]]></htmlView>
                                <jsonProperties>{"files":["content/images/pic.png"]}</jsonProperties>
                            </odeComponent>
                        </odeComponents>
                    </odePagStructure>
                </odePagStructures>
            </odeNavStructure>
        </odeNavStructures>
    </ode>`;

    test('parseContentXml reports malformed XML', () => {
        const malformed = '<ode><unclosed></ode>';
        const result = parseContentXml(malformed);
        expect(result.status).toBe('error');
        expect(result.message).toMatch(/not well-formed|error/i);
    });

    test('parseContentXml parses valid XML', () => {
        const result = parseContentXml(minimalXml);
        expect(result.status).toBe('success');
        expect(result.document).toBeDefined();
    });

    test('checkRootElement validates the <ode> element', () => {
        const { document } = parseContentXml(minimalXml);
        const result = checkRootElement(document);
        expect(result.status).toBe('success');
    });

    test('checkRootElement fails for unexpected root', () => {
        const xml = '<?xml version="1.0"?><root></root>';
        const { document } = parseContentXml(xml);
        const result = checkRootElement(document);
        expect(result.status).toBe('error');
        expect(result.message).toMatch(/expected the root element/i);
    });

    test('checkNavStructures fails when element missing', () => {
        const xml = '<?xml version="1.0"?><ode></ode>';
        const { document } = parseContentXml(xml);
        const result = checkNavStructures(document);
        expect(result.status).toBe('error');
    });

    test('checkPagePresence warns when there are no pages', () => {
        const xml = '<?xml version="1.0"?><ode><odeNavStructures></odeNavStructures></ode>';
        const { document } = parseContentXml(xml);
        const result = checkPagePresence(document);
        expect(result.status).toBe('warning');
    });

    test('validateStructuralIntegrity reports missing fields', () => {
        const xml = `<?xml version="1.0"?>
            <ode>
                <odeNavStructures>
                    <odeNavStructure>
                        <odePageId>p1</odePageId>
                        <odePagStructures>
                            <odePagStructure>
                                <odeComponents>
                                    <odeComponent>
                                        <odeIdeviceId>c1</odeIdeviceId>
                                    </odeComponent>
                                </odeComponents>
                            </odePagStructure>
                        </odePagStructures>
                    </odeNavStructure>
                </odeNavStructures>
            </ode>`;
        const { document } = parseContentXml(xml);
        const result = validateStructuralIntegrity(document);
        expect(result.status).toBe('error');
        expect(result.message).toMatch(/missing fields/i);
    });

    test('validateStructuralIntegrity succeeds for minimal valid XML', () => {
        const { document } = parseContentXml(minimalXml);
        const result = validateStructuralIntegrity(document);
        expect(result.status).toBe('success');
    });

    test('extractResourcePaths finds HTML and JSON references', () => {
        const { document } = parseContentXml(minimalXml);
        const resources = extractResourcePaths(document);
        expect(resources).toContain('content/images/pic.png');
        expect(resources.length).toBe(1);
    });

    test('findMissingResources identifies absent files', () => {
        const paths = ['content/images/pic.png'];
        const mockZip = {
            file: jest.fn().mockReturnValue(null)
        };
        const missing = findMissingResources(paths, mockZip);
        expect(missing).toEqual(paths);
    });

    test('findMissingResources ignores existing files', () => {
        const paths = ['content/images/pic.png'];
        const mockZip = {
            file: jest.fn((name) => (name === 'content/images/pic.png' ? {} : null))
        };
        const missing = findMissingResources(paths, mockZip);
        expect(missing).toHaveLength(0);
    });

    test('normalizeResourcePath cleans relative and encoded paths', () => {
        expect(normalizeResourcePath('./content/My%20File.png')).toBe('content/My File.png');
        expect(normalizeResourcePath('/custom\\file.txt')).toBe('custom/file.txt');
    });
});
