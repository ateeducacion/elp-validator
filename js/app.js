(function () {
    const validator = typeof ELPValidator !== 'undefined' ? ELPValidator : {};
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const resultsSection = document.getElementById('results');
    const fileNameElement = document.getElementById('fileName');
    const checklist = document.getElementById('checklist');
    const metadataSection = document.getElementById('packageMetadata');
    const metadataFields = {
        title: document.getElementById('meta-title'),
        author: document.getElementById('meta-author'),
        language: document.getElementById('meta-language'),
        description: document.getElementById('meta-description'),
        license: document.getElementById('meta-license'),
        version: document.getElementById('meta-version'),
        identifier: document.getElementById('meta-identifier')
    };
    const metadataMore = document.getElementById('metadataMore');
    const metadataPropertiesList = document.getElementById('meta-properties');
    const metadataResourcesList = document.getElementById('meta-resources');
    const metadataPropertiesSection = document.getElementById('meta-properties-section');
    const metadataResourcesSection = document.getElementById('meta-resources-section');

    if (!dropzone || !fileInput || !checklist) {
        console.error('The validator UI elements are missing.');
        return;
    }

    const iconMap = {
        pending: '⏳',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };

    function clearMetadata() {
        if (metadataSection) {
            metadataSection.hidden = true;
        }
        Object.values(metadataFields).forEach((field) => {
            if (field) {
                field.textContent = '—';
            }
        });
        if (metadataMore) {
            metadataMore.hidden = true;
            metadataMore.open = false;
        }
        if (metadataPropertiesList) {
            metadataPropertiesList.innerHTML = '';
        }
        if (metadataResourcesList) {
            metadataResourcesList.innerHTML = '';
        }
        if (metadataPropertiesSection) {
            metadataPropertiesSection.style.display = 'none';
        }
        if (metadataResourcesSection) {
            metadataResourcesSection.style.display = 'none';
        }
    }

    function resetChecklist() {
        const items = checklist.querySelectorAll('.check-item');
        items.forEach((item) => {
            item.className = 'check-item pending';
            const icon = item.querySelector('.icon');
            const label = item.dataset.label || 'Running check';
            const details = item.querySelector('.details');
            if (icon) {
                icon.textContent = iconMap.pending;
            }
            const labelElement = item.querySelector('.label');
            if (labelElement) {
                labelElement.innerHTML = `${label}...`;
            }
            if (details) {
                details.textContent = '';
                details.style.display = 'none';
            }
        });
    }

    function populateKeyValueList(container, entries) {
        if (!container) {
            return;
        }

        container.innerHTML = '';
        entries.forEach(([key, value]) => {
            const item = document.createElement('li');
            const keyElement = document.createElement('code');
            keyElement.textContent = key;
            const valueElement = document.createElement('span');
            valueElement.className = 'metadata-value';
            valueElement.textContent = value || '—';
            item.appendChild(keyElement);
            item.appendChild(document.createTextNode(': '));
            item.appendChild(valueElement);
            container.appendChild(item);
        });
    }

    function renderMetadata(metadata) {
        if (!metadataSection || !metadata) {
            return;
        }

        const properties = metadata.properties || {};
        const resources = metadata.resources || {};
        const hasMetadata = Object.keys(properties).length > 0 || Object.keys(resources).length > 0;

        if (!hasMetadata) {
            metadataSection.hidden = true;
            if (metadataMore) {
                metadataMore.hidden = true;
            }
            return;
        }

        const fieldValues = {
            title: properties.pp_title || properties.title || '',
            author: properties.pp_author || '',
            language: properties.pp_lang || properties.language || '',
            description: properties.pp_description || '',
            license: properties.license || '',
            version: resources.odeVersionName || properties.version || '',
            identifier: resources.odeId || resources.odeVersionId || ''
        };

        Object.entries(fieldValues).forEach(([key, value]) => {
            const field = metadataFields[key];
            if (field) {
                field.textContent = value || '—';
            }
        });

        const primaryPropertyKeys = new Set(['pp_title', 'pp_author', 'pp_lang', 'pp_description', 'license', 'title', 'language', 'version']);
        const primaryResourceKeys = new Set(['odeVersionName', 'odeId', 'odeVersionId']);

        const extraPropertyEntries = Object.entries(properties).filter(([key]) => !primaryPropertyKeys.has(key));
        const extraResourceEntries = Object.entries(resources).filter(([key]) => !primaryResourceKeys.has(key));

        if (metadataPropertiesSection) {
            metadataPropertiesSection.style.display = extraPropertyEntries.length > 0 ? '' : 'none';
        }
        if (metadataResourcesSection) {
            metadataResourcesSection.style.display = extraResourceEntries.length > 0 ? '' : 'none';
        }

        populateKeyValueList(metadataPropertiesList, extraPropertyEntries);
        populateKeyValueList(metadataResourcesList, extraResourceEntries);

        if (metadataMore) {
            const hasExtra = extraPropertyEntries.length > 0 || extraResourceEntries.length > 0;
            metadataMore.hidden = !hasExtra;
            if (!hasExtra) {
                metadataMore.open = false;
            }
        }

        metadataSection.hidden = false;
    }

    function setChecklistStatus(id, status, message) {
        const item = document.getElementById(id);
        if (!item) {
            return;
        }
        item.className = `check-item ${status}`;
        const icon = item.querySelector('.icon');
        const details = item.querySelector('.details');
        const labelElement = item.querySelector('.label');
        if (icon && iconMap[status]) {
            icon.textContent = iconMap[status];
        }
        if (details) {
            if (message) {
                details.textContent = message;
                details.style.display = 'block';
            } else {
                details.textContent = '';
                details.style.display = 'none';
            }
        }
        if (labelElement && status !== 'pending') {
            const label = item.dataset.label || labelElement.textContent;
            labelElement.innerHTML = `${label}${status === 'success' ? ' ✓' : ''}`;
        }
    }

    async function handleFile(file) {
        if (!file) {
            return;
        }

        resultsSection.hidden = false;
        fileNameElement.textContent = file.name;
        clearMetadata();
        resetChecklist();

        let zip;
        try {
            const arrayBuffer = await file.arrayBuffer();
            zip = await JSZip.loadAsync(arrayBuffer);
            setChecklistStatus('check-zip', 'success', 'The archive was loaded successfully.');
        } catch (error) {
            console.error(error);
            setChecklistStatus('check-zip', 'error', 'The file is not a valid ZIP archive or is corrupted.');
            return;
        }

        const contentFile = zip.file('content.xml');
        if (!contentFile) {
            setChecklistStatus('check-content-xml', 'error', 'content.xml was not found in the archive.');
            return;
        }
        setChecklistStatus('check-content-xml', 'success', 'Found content.xml in the package.');

        const hasContentResources = Object.keys(zip.files).some((name) => name.startsWith('content/'));
        const hasCustomFiles = Object.keys(zip.files).some((name) => name.startsWith('custom/'));
        if (hasContentResources || hasCustomFiles) {
            const messages = [];
            if (hasContentResources) {
                messages.push('content/ directory detected');
            }
            if (hasCustomFiles) {
                messages.push('custom/ directory detected');
            }
            setChecklistStatus('check-folders', 'success', messages.join(' • '));
        } else {
            setChecklistStatus('check-folders', 'warning', 'Recommended resource folders were not found.');
        }

        let xmlString = '';
        try {
            xmlString = await contentFile.async('string');
        } catch (error) {
            console.error(error);
            setChecklistStatus('check-xml-well-formed', 'error', 'Unable to read content.xml from the archive.');
            return;
        }

        const parseResult = validator.parseContentXml(xmlString);
        if (parseResult.status === 'error') {
            setChecklistStatus('check-xml-well-formed', 'error', parseResult.message);
            return;
        }
        setChecklistStatus('check-xml-well-formed', 'success', 'content.xml is well-formed.');

        const xmlDoc = parseResult.document;
        const metadata = validator.extractMetadata ? validator.extractMetadata(xmlDoc) : null;
        if (metadata) {
            renderMetadata(metadata);
        }
        const rootResult = validator.checkRootElement(xmlDoc);
        setChecklistStatus('check-root-element', rootResult.status, rootResult.message);
        if (rootResult.status === 'error') {
            return;
        }

        const navResult = validator.checkNavStructures(xmlDoc);
        setChecklistStatus('check-nav-structures', navResult.status, navResult.message);
        if (navResult.status === 'error') {
            return;
        }

        const pagesResult = validator.checkPagePresence(xmlDoc);
        setChecklistStatus('check-pages', pagesResult.status, pagesResult.message);

        const structureResult = validator.validateStructuralIntegrity(xmlDoc);
        setChecklistStatus('check-structure', structureResult.status, structureResult.message);

        const resourcePaths = validator.extractResourcePaths(xmlDoc);
        const missingResources = validator.findMissingResources(resourcePaths, zip);
        if (missingResources.length === 0) {
            const detail = resourcePaths.length > 0
                ? `All ${resourcePaths.length} linked resource${resourcePaths.length === 1 ? '' : 's'} are present.`
                : 'No linked resources were detected.';
            setChecklistStatus('check-resources', 'success', detail);
        } else {
            setChecklistStatus(
                'check-resources',
                'warning',
                `The following resources could not be found: ${missingResources.slice(0, 5).join(', ')}${missingResources.length > 5 ? ', …' : ''}`
            );
        }
    }

    function preventDefaults(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInput.click();
        }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            preventDefaults(event);
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            preventDefaults(event);
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', async (event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            await handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            await handleFile(files[0]);
            fileInput.value = '';
        }
    });
})();
