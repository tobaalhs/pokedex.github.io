document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const errorMessage = document.getElementById('errorMessage');
    const loadingMessage = document.getElementById('loadingMessage');
    const pokemonInfo = document.getElementById('pokemonInfo');
    let currentPokemonId = null;
    const pokemonCache = new Map();

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function formatPokemonId(id) {
        return `#${String(id).padStart(3, '0')}`;
    }

    // tipos en espaÑol
    const typeTranslations = {
        normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
        grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
        ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
        rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
        steel: 'Acero', fairy: 'Hada'
    };

    // stats cambio de nombre
    function formatStatName(statName) {
        const statNames = {
            'hp': 'HP',
            'attack': 'Ataque',
            'defense': 'Defensa',
            'special-attack': 'Ataque Esp.',
            'special-defense': 'Defensa Esp.',
            'speed': 'Velocidad'
        };
        return statNames[statName] || capitalize(statName);
    }

    // color estadistica
    function getStatColor(statValue) {
        if (statValue >= 150) return '#4CAF50';
        if (statValue >= 100) return '#8BC34A';
        if (statValue >= 70) return '#CDDC39';
        if (statValue >= 50) return '#FFC107';
        return '#FF5722';
    }

    // evoluciones
    async function getEvolutionChain(evolutionUrl) {
        try {
            const response = await fetch(evolutionUrl);
            const data = await response.json();
            const evolutionChain = [];
            
            let evoData = data.chain;
            
            do {
                const evoDetails = evoData.evolution_details[0];
                evolutionChain.push({
                    name: evoData.species.name,
                    min_level: evoDetails?.min_level ?? null,
                    trigger: evoDetails?.trigger?.name ?? null,
                    item: evoDetails?.item?.name ?? null
                });
                
                evoData = evoData.evolves_to[0];
            } while (evoData && evoData.hasOwnProperty('evolves_to'));
            
            return evolutionChain;
        } catch (error) {
            console.error("Error fetching evolution chain:", error);
            return [];
        }
    }

    // cadena evolucion
    async function getEvolutionDetails(evolutionChain) {
        const evolutionDetails = await Promise.all(
            evolutionChain.map(async (evo) => {
                const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${evo.name}`);
                const data = await response.json();
                return {
                    ...evo,
                    id: data.id,
                    image: data.sprites.front_default,
                    types: data.types
                };
            })
        );
        return evolutionDetails;
    }

    // html cadena
    function createEvolutionHTML(evolutionDetails) {
        return evolutionDetails.map((pokemon, index) => {
            const evolutionTrigger = index > 0 ? getEvolutionTriggerText(pokemon) : '';
            
            return `
                <div class="evolution-item">
                    ${index > 0 ? `<div class="evolution-arrow">→<div class="evolution-trigger">${evolutionTrigger}</div></div>` : ''}
                    <div class="evolution-pokemon" onclick="handlePokemonClick(${pokemon.id})">
                        <img src="${pokemon.image}" alt="${pokemon.name}">
                        <div class="evolution-name">${capitalize(pokemon.name)} ${formatPokemonId(pokemon.id)}</div>
                        <div class="evolution-types">
                            ${pokemon.types.map(type => `
                                <span class="type-badge ${type.type.name}">
                                    ${typeTranslations[type.type.name]}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // texto evolucion
    function getEvolutionTriggerText(pokemon) {
        if (pokemon.min_level) {
            return `Nivel ${pokemon.min_level}`;
        } else if (pokemon.item) {
            return `Usar ${capitalize(pokemon.item.replace(/-/g, ' '))}`;
        } else if (pokemon.trigger === 'trade') {
            return 'Intercambio';
        }
        return 'Especial';
    }

    // search
    async function searchPokemon() {
        const search = searchInput.value.toLowerCase().trim();
        
        if (!search) return;

        try {
            loadingMessage.style.display = 'flex';
            errorMessage.style.display = 'none';
            pokemonInfo.classList.remove('visible');
            pokemonInfo.innerHTML = '';

            // cache
            if (pokemonCache.has(search)) {
                const cachedData = pokemonCache.get(search);
                displayPokemonInfo(cachedData.pokemon, cachedData.species, cachedData.evolutionDetails);
                loadingMessage.style.display = 'none';
                return;
            }

            const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${search}`);
            if (!pokemonResponse.ok) throw new Error('Pokémon no encontrado');
            const pokemonData = await pokemonResponse.json();

            const speciesResponse = await fetch(pokemonData.species.url);
            const speciesData = await speciesResponse.json();

            const evolutionResponse = await fetch(speciesData.evolution_chain.url);
            const evolutionData = await evolutionResponse.json();

            const evolutionChain = await getEvolutionChain(speciesData.evolution_chain.url);
            const evolutionDetails = await getEvolutionDetails(evolutionChain);

            // para guardar en cache
            pokemonCache.set(search, {
                pokemon: pokemonData,
                species: speciesData,
                evolutionDetails: evolutionDetails
            });

            displayPokemonInfo(pokemonData, speciesData, evolutionDetails);
            
            
            window.history.pushState({}, '', `?pokemon=${search}`);
            currentPokemonId = pokemonData.id;

        } catch (error) {
            errorMessage.textContent = 'No se pudo encontrar el Pokémon. Verifica el nombre o ID.';
            errorMessage.style.display = 'block';
        } finally {
            loadingMessage.style.display = 'none';
        }
    }

    // mostrar info pokemon
    function displayPokemonInfo(pokemon, species, evolutionDetails) {
        const description = species.flavor_text_entries
            .find(entry => entry.language.name === 'es')?.flavor_text || 
            species.flavor_text_entries[0].flavor_text;

        const genera = species.genera.find(g => g.language.name === 'es')?.genus || 
            species.genera[0].genus;

        const html = `
            <div class="pokemon-basic-info">
                <div class="pokemon-header">
                    <button onclick="handlePrevPokemon()" class="nav-button" ${pokemon.id === 1 ? 'disabled' : ''}>←</button>
                    <div class="pokemon-title">
                        <h2 class="pokemon-name">${capitalize(pokemon.name)} ${formatPokemonId(pokemon.id)}</h2>
                        <div class="pokemon-genus">${genera}</div>
                    </div>
                    <button 
                    onclick="handleNextPokemon()" 
                    class="nav-button"
                    ${pokemon.id === 1025 ? 'disabled' : ''}
                >→</button>
                </div>

                <div class="pokemon-showcase">
                    <img class="pokemon-image" 
                        src="${pokemon.sprites.front_default}" 
                        alt="${pokemon.name}"
                    >
                    
                    <div class="pokemon-types">
                        ${pokemon.types.map(type => `
                            <span class="type-badge ${type.type.name}">
                                ${typeTranslations[type.type.name]}
                            </span>
                        `).join('')}
                    </div>
                </div>

                <div class="pokemon-description">
                    ${description.replace(/\f/g, ' ')}
                </div>

                <div class="pokemon-details">
                    <div class="detail-item">
                        <span class="detail-label">Altura</span>
                        <span class="detail-value">${(pokemon.height / 10).toFixed(1)} m</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Peso</span>
                        <span class="detail-value">${(pokemon.weight / 10).toFixed(1)} kg</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Hábitat</span>
                        <span class="detail-value">${species.habitat ? capitalize(species.habitat.name) : 'Desconocido'}</span>
                    </div>
                </div>
            </div>

            <div class="stats-container">
                <h3>Estadísticas base</h3>
                <div class="stats-grid">
                    ${pokemon.stats.map(stat => {
                        const percentage = (stat.base_stat / 255) * 100;
                        return `
                            <div class="stat-item">
                                <span class="stat-label">${formatStatName(stat.stat.name)}</span>
                                <div class="stat-bar-container">
                                    <div class="stat-bar" 
                                         style="width: ${percentage}%; background-color: ${getStatColor(stat.base_stat)}">
                                        <span class="stat-value">${stat.base_stat}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="evolution-chain">
                <h3>Cadena evolutiva</h3>
                <div class="evolution-container">
                    ${createEvolutionHTML(evolutionDetails)}
                </div>
            </div>

            <div class="abilities-container">
                <h3>Habilidades</h3>
                <div class="abilities-grid">
                    ${pokemon.abilities.map(ability => `
                        <div class="ability-item ${ability.is_hidden ? 'hidden-ability' : ''}">
                            <span class="ability-name">${capitalize(ability.ability.name.replace(/-/g, ' '))}</span>
                            ${ability.is_hidden ? '<span class="hidden-badge">Oculta</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        pokemonInfo.innerHTML = html;
        pokemonInfo.classList.add('visible');

        // Remover la clase después de la animación
        setTimeout(() => {
            pokemonInfo.classList.remove('fade-in');
        }, 300); // 300ms = 0.3s (duración de la animación)
    }

    searchButton.addEventListener('click', searchPokemon);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPokemon();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!currentPokemonId) return;
    
        if (e.key === 'ArrowLeft' && currentPokemonId > 1) {
            handlePrevPokemon();
        } else if (e.key === 'ArrowRight' && currentPokemonId < MAX_POKEMON_ID) {
            handleNextPokemon();
        }
    });

    window.handlePrevPokemon = function() {
        if (currentPokemonId > 1) {
            currentPokemonId -= 1;
            searchInput.value = currentPokemonId.toString();
            searchPokemon();
        }
    };
    
    window.handleNextPokemon = function() {
        if (currentPokemonId < 1025) {
            currentPokemonId += 1;
            searchInput.value = currentPokemonId.toString();
            searchPokemon();
        }
    };
    

    window.handlePokemonClick = function(id) {
        searchInput.value = id.toString();
        searchPokemon();
    };

    const urlParams = new URLSearchParams(window.location.search);
    const initialPokemon = urlParams.get('pokemon');
    if (initialPokemon) {
        searchInput.value = initialPokemon;
        searchPokemon();
    }
});