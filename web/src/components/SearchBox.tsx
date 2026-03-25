import React, { useState, useEffect, useRef } from 'react';
import './SearchBox.css';

interface SearchResult {
    id: number;
    name: string;
    display_name: string;
    latitude?: number;
    longitude?: number;
}

interface SearchBoxProps {
    onSelect: (result: SearchResult) => void;
    placeholder?: string;
    initialValue?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ 
    onSelect, 
    placeholder = "Введите название населенного пункта...",
    initialValue = ""
}) => {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        setLoading(true);
        setShowDropdown(true);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            fetch(`/api/posts/search/settlements?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    console.log('Search results:', data);
                    // Убедитесь, что data.results существует и это массив
                    setResults(data.results || []);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Search error:', err);
                    setResults([]);
                    setLoading(false);
                });
        }, 300);
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        console.log('Selected result:', result);
        setQuery(result.name);
        setShowDropdown(false);
        onSelect(result); // Передаем полный объект результата
    };

    return (
        <div className="search-box-container" ref={wrapperRef}>
            <input
                type="text"
                className="search-box-input"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length >= 2 && setShowDropdown(true)}
            />
            
            {showDropdown && (
                <div className="search-dropdown">
                    {loading && (
                        <div className="dropdown-item loading">Поиск...</div>
                    )}
                    
                    {!loading && results.length === 0 && (
                        <div className="dropdown-item empty">Ничего не найдено</div>
                    )}
                    
                    {results.map((result) => (
                        <div
                            key={result.id}
                            className="dropdown-item"
                            onClick={() => handleSelect(result)}
                        >
                            {result.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchBox;