(function (global, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        global.ELPValidator = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const REQUIRED_NAV_FIELDS = [
        'odePageId',
        'pageName',
        ['odeNavStructureSyncOrder', 'odeNavStructureOrder']
    ];
    const REQUIRED_BLOCK_FIELDS = ['odeBlockId', 'blockName'];
    const REQUIRED_COMPONENT_FIELDS = ['odeIdeviceId', 'odeIdeviceTypeName', 'htmlView', 'jsonProperties'];

    function parseContentXml(xmlString) {
        if (typeof xmlString !== 'string') {
            return { status: 'error', message: 'The provided XML payload is not a string.' };
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        const parserError = xmlDoc.querySelector('parsererror');

        if (parserError) {
            const message = parserError.textContent || 'The XML document is not well-formed.';
            return { status: 'error', message };
        }

        return { status: 'success', document: xmlDoc };
    }

    function checkRootElement(xmlDoc) {
        if (!xmlDoc || !xmlDoc.documentElement) {
            return { status: 'error', message: 'Unable to read the XML root element.' };
        }

        const tagName = xmlDoc.documentElement.tagName;
        if (!tagName) {
            return { status: 'error', message: 'The XML root element is missing a tag name.' };
        }

        if (tagName.toLowerCase() !== 'ode') {
            return {
                status: 'error',
                message: `Expected the root element to be <ode>, found <${tagName}> instead.`
            };
        }

        return { status: 'success', message: 'The root element is <ode>.' };
    }

    function checkNavStructures(xmlDoc) {
        const navStructures = xmlDoc.getElementsByTagName('odeNavStructures');
        if (!navStructures || navStructures.length === 0) {
            return { status: 'error', message: 'The <odeNavStructures> element is missing.' };
        }

        return { status: 'success', message: 'Navigation structures found.' };
    }

    function checkPagePresence(xmlDoc) {
        const pages = xmlDoc.getElementsByTagName('odeNavStructure');
        if (!pages || pages.length === 0) {
            return {
                status: 'warning',
                message: 'No <odeNavStructure> entries were found. The project appears to be empty.'
            };
        }

        return { status: 'success', message: `Found ${pages.length} page${pages.length === 1 ? '' : 's'}.` };
    }

    function formatRequirement(requirement) {
        return Array.isArray(requirement) ? requirement.join(' / ') : requirement;
    }

    function ensureChildTags(node, requiredTags) {
        const missing = [];
        requiredTags.forEach((requirement) => {
            const tags = Array.isArray(requirement) ? requirement : [requirement];
            const hasAny = tags.some((tag) => node.getElementsByTagName(tag)[0]);
            if (!hasAny) {
                missing.push(formatRequirement(requirement));
            }
        });
        return missing;
    }

    function validateStructuralIntegrity(xmlDoc) {
        const issues = [];
        const navStructures = Array.from(xmlDoc.getElementsByTagName('odeNavStructure'));

        navStructures.forEach((navStructure, index) => {
            const missingNavFields = ensureChildTags(navStructure, REQUIRED_NAV_FIELDS);
            if (missingNavFields.length > 0) {
                issues.push(`Navigation structure #${index + 1} is missing fields: ${missingNavFields.join(', ')}`);
            }

            const pageStructures = navStructure.getElementsByTagName('odePagStructure');
            Array.from(pageStructures).forEach((pageStructure, blockIndex) => {
                const missingBlockFields = ensureChildTags(pageStructure, REQUIRED_BLOCK_FIELDS);
                if (missingBlockFields.length > 0) {
                    issues.push(`Block #${blockIndex + 1} in page #${index + 1} is missing fields: ${missingBlockFields.join(', ')}`);
                }

                const components = pageStructure.getElementsByTagName('odeComponent');
                Array.from(components).forEach((component, componentIndex) => {
                    const missingComponentFields = ensureChildTags(component, REQUIRED_COMPONENT_FIELDS);
                    if (missingComponentFields.length > 0) {
                        issues.push(`Component #${componentIndex + 1} in block #${blockIndex + 1} of page #${index + 1} is missing fields: ${missingComponentFields.join(', ')}`);
                    }
                });
            });
        });

        if (issues.length > 0) {
            return {
                status: 'error',
                message: issues.join(' ')
            };
        }

        return { status: 'success', message: 'The internal XML structure matches the expected layout.' };
    }

    function extractResourcePaths(xmlDoc) {
        const resourcePaths = new Set();
        const htmlNodes = Array.from(xmlDoc.getElementsByTagName('htmlView'));
        const jsonNodes = Array.from(xmlDoc.getElementsByTagName('jsonProperties'));
        const attributeRegex = /(?:src|href)=["']([^"']+)["']/gi;
        const resourceRegex = /(content|custom)\//i;

        htmlNodes.forEach((node) => {
            const text = node.textContent || '';
            let match;
            while ((match = attributeRegex.exec(text)) !== null) {
                const value = match[1];
                if (resourceRegex.test(value)) {
                    resourcePaths.add(normalizeResourcePath(value));
                }
            }
        });

        jsonNodes.forEach((node) => {
            const text = node.textContent || '';
            try {
                const json = JSON.parse(text);
                collectPathsFromJson(json, resourcePaths);
            } catch (error) {
                // The JSON block may include template variables that are not valid JSON.
                // Fallback to a regex search similar to the HTML view parsing.
                let match;
                while ((match = attributeRegex.exec(text)) !== null) {
                    const value = match[1];
                    if (resourceRegex.test(value)) {
                        resourcePaths.add(normalizeResourcePath(value));
                    }
                }
            }
        });

        return Array.from(resourcePaths);
    }

    function collectPathsFromJson(value, accumulator) {
        if (!value) {
            return;
        }

        if (typeof value === 'string') {
            if (/(content|custom)\//i.test(value)) {
                accumulator.add(normalizeResourcePath(value));
            }
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => collectPathsFromJson(item, accumulator));
            return;
        }

        if (typeof value === 'object') {
            Object.values(value).forEach((item) => collectPathsFromJson(item, accumulator));
        }
    }

    function normalizeResourcePath(path) {
        return decodeURIComponent(path.trim())
            .replace(/^\.\//, '')
            .replace(/^\//, '')
            .replace(/\\/g, '/');
    }

    function findMissingResources(paths, zip) {
        if (!paths || paths.length === 0) {
            return [];
        }

        const missing = [];
        paths.forEach((path) => {
            const normalized = normalizeResourcePath(path);
            if (!zip.file(normalized)) {
                // Some resources might be stored with URI encoded file names.
                const encoded = encodeURI(normalized);
                if (!zip.file(encoded)) {
                    missing.push(path);
                }
            }
        });
        return missing;
    }

    function extractMetadata(xmlDoc) {
        const metadata = { properties: {}, resources: {} };

        const propertyNodes = Array.from(xmlDoc.getElementsByTagName('odeProperty'));
        propertyNodes.forEach((property) => {
            const keyNode = property.getElementsByTagName('key')[0];
            if (!keyNode || !keyNode.textContent) {
                return;
            }
            const valueNode = property.getElementsByTagName('value')[0];
            const key = keyNode.textContent.trim();
            const value = valueNode && valueNode.textContent ? valueNode.textContent.trim() : '';
            if (key) {
                metadata.properties[key] = value;
            }
        });

        const resourceNodes = Array.from(xmlDoc.getElementsByTagName('odeResource'));
        resourceNodes.forEach((resource) => {
            const keyNode = resource.getElementsByTagName('key')[0];
            if (!keyNode || !keyNode.textContent) {
                return;
            }
            const valueNode = resource.getElementsByTagName('value')[0];
            const key = keyNode.textContent.trim();
            const value = valueNode && valueNode.textContent ? valueNode.textContent.trim() : '';
            if (key) {
                metadata.resources[key] = value;
            }
        });

        return metadata;
    }

    return {
        parseContentXml,
        checkRootElement,
        checkNavStructures,
        checkPagePresence,
        validateStructuralIntegrity,
        extractResourcePaths,
        findMissingResources,
        normalizeResourcePath,
        extractMetadata
    };
});
