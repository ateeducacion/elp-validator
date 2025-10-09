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
        identifier: document.getElementById('meta-identifier'),
        fileSize: document.getElementById('meta-filesize')
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

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return '—';
        const thresh = 1024;
        if (Math.abs(bytes) < thresh) {
            return `${bytes} B`;
        }
        const units = ['KB', 'MB', 'GB', 'TB'];
        let u = -1;
        let value = bytes;
        do {
            value /= thresh;
            u += 1;
        } while (Math.abs(value) >= thresh && u < units.length - 1);
        return `${value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0)} ${units[u]}`;
    }

    function renderPageTitles(titles) {
        const item = document.getElementById('check-pages');
        if (!item) return;
        const container = item.querySelector('div');
        if (!container) return;
        const existing = item.querySelector('.pages-collapsible');
        if (existing) existing.remove();
        if (!titles || titles.length === 0) return;

        const details = document.createElement('details');
        details.className = 'pages-collapsible';
        details.open = false;

        const summary = document.createElement('summary');
        summary.textContent = `Show page titles (${titles.length})`;
        details.appendChild(summary);

        const list = document.createElement('ul');
        list.className = 'pages-list';
        titles.forEach((title) => {
            const li = document.createElement('li');
            li.textContent = title || '(untitled)';
            list.appendChild(li);
        });
        details.appendChild(list);

        container.appendChild(details);
    }

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
        const pagesItem = document.getElementById('check-pages');
        if (pagesItem) {
            const extra = pagesItem.querySelector('.pages-collapsible');
            if (extra) extra.remove();
        }
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
            let displayValue = value;
            if (displayValue === null || displayValue === undefined || displayValue === '') {
                displayValue = '—';
            } else if (typeof displayValue === 'object') {
                try {
                    displayValue = JSON.stringify(displayValue, null, 2);
                } catch (error) {
                    displayValue = String(displayValue);
                }
            }
            valueElement.textContent = displayValue;
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
        // Show file size immediately
        if (metadataFields.fileSize) {
            metadataFields.fileSize.textContent = formatBytes(file.size);
        }
        if (metadataSection) {
            metadataSection.hidden = false;
        }
        resetChecklist();

        let zip;
        let manifestName = 'content.xml';
        let manifestKind = 'modern';
        try {
            const arrayBuffer = await file.arrayBuffer();
            zip = await JSZip.loadAsync(arrayBuffer);
            setChecklistStatus('check-zip', 'success', 'The archive was loaded successfully.');
        } catch (error) {
            console.error(error);
            setChecklistStatus('check-zip', 'error', 'The file is not a valid ZIP archive or is corrupted.');
            return;
        }

        let manifestFile = zip.file('content.xml');
        if (!manifestFile) {
            manifestFile = zip.file('contentv3.xml');
            if (manifestFile) {
                manifestName = 'contentv3.xml';
                manifestKind = 'legacy';
                setChecklistStatus(
                    'check-content-xml',
                    'warning',
                    'content.xml is missing, but legacy contentv3.xml was found. This package was created with an eXeLearning version earlier than 3.0.'
                );
            } else {
                setChecklistStatus(
                    'check-content-xml',
                    'error',
                    'Neither content.xml nor legacy contentv3.xml were found. This package is not compatible with modern eXeLearning releases.'
                );
                return;
            }
        } else {
            setChecklistStatus('check-content-xml', 'success', 'Found content.xml in the package.');
        }

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
            xmlString = await manifestFile.async('string');
        } catch (error) {
            console.error(error);
            setChecklistStatus('check-xml-well-formed', 'error', `Unable to read ${manifestName} from the archive.`);
            return;
        }

        const parseResult = validator.parseContentXml(xmlString);
        if (parseResult.status === 'error') {
            setChecklistStatus('check-xml-well-formed', 'error', parseResult.message);
            return;
        }
        setChecklistStatus('check-xml-well-formed', 'success', `${manifestName} is well-formed.`);

        const xmlDoc = parseResult.document;
        const metadata =
            manifestKind === 'legacy'
                ? validator.normalizeLegacyMetadata?.(validator.extractLegacyMetadata?.(xmlDoc))
                : validator.extractMetadata?.(xmlDoc);
        if (metadata) {
            renderMetadata(metadata);
        }
        // Ensure file size is shown even if no metadata
        if (metadataFields.fileSize) {
            metadataFields.fileSize.textContent = formatBytes(file.size);
        }
        if (metadataSection) {
            metadataSection.hidden = false;
        }

        if (manifestKind === 'legacy') {
            setChecklistStatus(
                'check-root-element',
                'warning',
                'Legacy manifest format detected (<instance>). Structural validation checks for modern packages were skipped.'
            );
            const skippedMessage = 'Skipped: legacy eXeLearning manifests (contentv3.xml) do not expose modern navigation structures.';
            setChecklistStatus('check-nav-structures', 'warning', skippedMessage);
            setChecklistStatus('check-pages', 'warning', skippedMessage);
            renderPageTitles([]);
            setChecklistStatus(
                'check-structure',
                'warning',
                'Skipped: legacy manifest layout is incompatible with the structural integrity rules used for modern packages.'
            );
            setChecklistStatus(
                'check-resources',
                'warning',
                'Resource validation is unavailable for legacy manifests. Inspect the package contents manually if needed.'
            );
            return;
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
        if (pagesResult.status === 'success' && typeof validator.extractPageTitles === 'function') {
            try {
                const titles = validator.extractPageTitles(xmlDoc);
                renderPageTitles(Array.isArray(titles) ? titles : []);
            } catch (_) {
                renderPageTitles([]);
            }
        } else {
            renderPageTitles([]);
        }

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
