document.addEventListener("DOMContentLoaded", function() {

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isDesktopLikeViewport = window.matchMedia('(min-width: 993px)').matches;

    const updateNavbarColor = (theme) => {
        const rootStyle = getComputedStyle(document.documentElement);
        let surfaceRgb;
        if (theme === 'light') {
            surfaceRgb = '246, 248, 250';
        } else {
            surfaceRgb = '22, 27, 34';
        }
        document.documentElement.style.setProperty('--color-surface-rgb', surfaceRgb);
    };

    const navbar = document.querySelector('.navbar');
    if (navbar) {
        updateNavbarColor(localStorage.getItem('theme') || 'dark');
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        });
    }

    const themeSlider = document.getElementById('theme-slider-checkbox');
    const htmlEl = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    
    // Set initial state
    htmlEl.setAttribute('data-theme', savedTheme);
    updateNavbarColor(savedTheme);
    if (themeSlider) {
        themeSlider.checked = (savedTheme === 'light');
    }

    if (themeSlider) {
        themeSlider.addEventListener('change', () => {
            let newTheme = themeSlider.checked ? 'light' : 'dark';
            htmlEl.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateNavbarColor(newTheme);
        });
    }

    /**
     * PROFILE DROPDOWN MENU
     */
    const profileToggle = document.getElementById('profile-toggle-btn');
    const profileDropdown = document.getElementById('profile-dropdown-menu');

    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            profileToggle.classList.toggle('active');
            profileDropdown.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (profileDropdown.classList.contains('active') && !profileDropdown.contains(e.target) && !profileToggle.contains(e.target)) {
                profileToggle.classList.remove('active');
                profileDropdown.classList.remove('active');
            }
        });
    }

    /**
     * ** UPDATED: AJAX VOTING with Alert **
     */
    document.querySelectorAll('.vote-button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent modal from opening
            
            // ** FIXED: Added the alert you requested **
            if (this.disabled) {
                alert('Please sign in to vote!');
                return;
            }

            const toolId = this.dataset.toolId;
            const voteCountSpan = this.querySelector('.vote-count');
            
            const isVoted = this.classList.toggle('voted');
            let currentVotes = parseInt(voteCountSpan.textContent);
            voteCountSpan.textContent = isVoted ? currentVotes + 1 : currentVotes - 1;

            fetch(`/vote/${toolId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            .then(response => response.ok ? response.json() : Promise.reject('Vote failed'))
            .then(data => {
                if (data.success) {
                    voteCountSpan.textContent = data.new_count;
                    this.classList.toggle('voted', data.voted);
                } else {
                    throw new Error(data.error || 'Vote failed');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.classList.toggle('voted'); // Revert
                voteCountSpan.textContent = currentVotes;
            });
        });
    });

    
    /**
     * Tool Detail Modal Logic
     */
    const allToolsDataScriptModal = document.getElementById('all-tools-data');
    const modal = document.getElementById('tool-modal');
    
    if (allToolsDataScriptModal && modal) {
        const allToolsForModal = JSON.parse(allToolsDataScriptModal.textContent);
        const modalCloseBtn = document.getElementById('modal-close-btn');

        // Open Modal
        document.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', function() {
                const toolId = parseInt(this.dataset.toolId, 10);
                const tool = allToolsForModal.find(t => t.id === toolId);
                
                if (tool) {
                    document.getElementById('modal-logo').src = tool.logo_url;
                    document.getElementById('modal-name').textContent = tool.name;
                    document.getElementById('modal-category').textContent = tool.category;
                    document.getElementById('modal-long-description').textContent = tool.long_description || tool.description;
                    document.getElementById('modal-visit-link').href = tool.url;
                    
                    modal.style.display = 'grid';
                    setTimeout(() => modal.classList.add('is-visible'), 10);
                    feather.replace();
                }
            });
        });

        // Close Modal
        const closeModal = () => {
            modal.classList.remove('is-visible');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        modalCloseBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }


    /**
     * ** UPDATED: Live Search with Keyboard Nav & "More Results" **
     */
    const searchInput = document.getElementById('search-input');
    const suggestionsContainer = document.getElementById('search-suggestions');
    const allToolsDataScriptSearch = document.getElementById('all-tools-data');
    let activeSuggestionIndex = -1;

    if (searchInput && suggestionsContainer && allToolsDataScriptSearch) {
        const allTools = JSON.parse(allToolsDataScriptSearch.textContent);

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            activeSuggestionIndex = -1; // Reset index
            
            if (query.length === 0) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            // ** FIXED: Filter ALL tools first (no slice) **
            const filteredTools = allTools.filter(tool => 
                tool.name.toLowerCase().includes(query) ||
                tool.category.toLowerCase().includes(query)
            );

            const totalMatches = filteredTools.length;
            const suggestionsToShow = filteredTools.slice(0, 5); // Now slice for display
            const remainingMatches = totalMatches - suggestionsToShow.length;

            suggestionsContainer.innerHTML = ''; // Clear old suggestions
            
            if (suggestionsToShow.length > 0) {
                suggestionsToShow.forEach(tool => {
                    const item = document.createElement('a');
                    item.className = 'suggestion-item';
                    item.href = `/?search=${encodeURIComponent(tool.name)}`;
                    
                    item.innerHTML = `
                        <img src="${tool.logo_url}" alt="${tool.name} logo">
                        <span class="name">${tool.name}</span>
                        <span class="category">${tool.category}</span>
                    `;
                    
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        searchInput.value = tool.name;
                        searchInput.closest('form').submit();
                    });
                    suggestionsContainer.appendChild(item);
                });

                // ** NEW: Add the "X more results" footer **
                if (remainingMatches > 0) {
                    const footer = document.createElement('div');
                    footer.className = 'suggestion-footer';
                    footer.textContent = `${remainingMatches} more results...`;
                    suggestionsContainer.appendChild(footer);
                }

                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });
        
        // ** FIXED: Added Keyboard navigation **
        searchInput.addEventListener('keydown', (e) => {
            const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
            if (suggestions.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault(); // Prevent cursor from moving in input
                activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
                updateActiveSuggestion(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); // Prevent cursor from moving in input
                activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
                updateActiveSuggestion(suggestions);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestionIndex > -1) {
                    suggestions[activeSuggestionIndex].click(); // Trigger click
                } else {
                    searchInput.closest('form').submit(); // Submit form
                }
            }
        });

        function updateActiveSuggestion(suggestions) {
            suggestions.forEach((item, index) => {
                item.classList.toggle('active', index === activeSuggestionIndex);
            });
            // Scroll the active item into view if needed
            if (activeSuggestionIndex > -1) {
                suggestions[activeSuggestionIndex].scrollIntoView({
                    block: 'nearest',
                });
            }
        }

        document.addEventListener('click', (e) => {
            if (!suggestionsContainer.contains(e.target) && e.target !== searchInput) {
                suggestionsContainer.style.display = 'none';
            }
        });
    }

    /**
     * Sticky/Fading Search Bar on Scroll
     * ** DISABLED: This logic conflicts with the new 100vh hero. **
     */
    /*
    const heroSearchContainer = document.getElementById('hero-search-container');
    if (heroSearchContainer) {
        const hero = document.querySelector('.hero');
        const heroHeight = hero ? hero.offsetHeight : 300;

        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            heroSearchContainer.classList.toggle('is-sticky', scrollY > heroHeight - 100);
            heroSearchContainer.classList.toggle('is-fading', scrollY > heroHeight + 50);
        });
    }
    */


    /**
     * ** NEW: Smooth scroll for hero arrow **
     */
    const scrollArrow = document.querySelector('.scroll-down-arrow');
    if (scrollArrow) {
        scrollArrow.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    }

    /**
     * ** NEW: Sticky Image-Changing Effect on Scroll **
     */
    const textBlocks = document.querySelectorAll('.text-block');
    const imageCards = document.querySelectorAll('.image-card');

    if (textBlocks.length > 0 && imageCards.length > 0) {
        if (!isDesktopLikeViewport || prefersReducedMotion) {
            imageCards.forEach((card, index) => {
                card.classList.toggle('active', index === 0);
            });
        } else {
        const observerOptions = {
            root: null, // relative to viewport
            rootMargin: '0px',
            threshold: 0.5 // 50% of the element must be visible
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const imageId = entry.target.dataset.imageId;
                    
                    // Deactivate all images
                    imageCards.forEach(card => {
                        card.classList.remove('active');
                    });
                    
                    // Activate the corresponding image
                    const activeImage = document.getElementById(imageId);
                    if (activeImage) {
                        activeImage.classList.add('active');
                    }
                }
            });
        }, observerOptions);

        // Observe all text blocks
        textBlocks.forEach(block => {
            observer.observe(block);
        });
        }
    }


    /**
     * SCROLL INTERACTION: Fade-in elements
     */
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    if (prefersReducedMotion) {
        revealElements.forEach(el => el.classList.add('is-visible'));
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        }, { threshold: 0.1 });
        revealElements.forEach(el => observer.observe(el));
    }


    /**
     * Custom Cursor Logic
     */
    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');
    const body = document.body;

    if (cursorDot && cursorOutline && supportsFinePointer) {
        window.addEventListener('mousemove', function (e) {
            cursorDot.style.left = `${e.clientX}px`;
            cursorDot.style.top = `${e.clientY}px`;
            cursorOutline.style.left = `${e.clientX}px`;
            cursorOutline.style.top = `${e.clientY}px`;
        });

        const hoverElements = document.querySelectorAll(
            'a, button, input, select, textarea, .vote-button, .suggestion-item, .profile-toggle, .theme-toggle, .logout-link, .nav-button-secondary, .nav-button-primary, .nav-button-login, .tool-card, .modal-close'
        );

        hoverElements.forEach(el => {
            el.addEventListener('mouseenter', () => body.classList.add('cursor-hovered'));
            el.addEventListener('mouseleave', () => body.classList.remove('cursor-hovered'));
        });

        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorOutline.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorOutline.style.opacity = '1';
        });
    } else {
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorOutline) cursorOutline.style.display = 'none';
        body.style.cursor = 'auto';
    }

    /**
     * Flash Message Auto-hide
     */
    const flashContainer = document.getElementById('flash-container');
    if (flashContainer) {
        const messages = flashContainer.querySelectorAll('.flash-message');
        messages.forEach((message, index) => {
            setTimeout(() => {
                message.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                message.style.opacity = '0';
                message.style.transform = 'translateY(-20px)';
                setTimeout(() => message.remove(), 500); 
            }, 4000 + index * 500);
        });
    }

    /**
     * Initialize Feather Icons
     */
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});
