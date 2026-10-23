import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown } from './Icons';

function formatMotionMeta(motion) {
  return `${Number(motion.duration || 0).toFixed(1)} s · ${motion.count || 0} poses`;
}

export default function MotionDropdown({ motionList, value, onSelect, disabled, loading }) {
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);

  const selectedMotion = motionList.find((motion) => motion.id === value);
  const optionId = (index) => `motion-dropdown-option-${index}`;

  const updateMenuPosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setMenuStyle({
      top: `${rect.bottom + 6}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      const clickedTrigger = wrapperRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedMenu) setIsOpen(false);
    };
    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  const selectMotion = (motion) => {
    onSelect(motion.id);
    setIsOpen(false);
  };

  const openMenu = () => {
    const selectedIndex = motionList.findIndex((motion) => motion.id === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    updateMenuPosition();
    setIsOpen(true);
  };

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    openMenu();
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setHighlightedIndex((currentIndex) => (
        (currentIndex + direction + motionList.length) % motionList.length
      ));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      const highlightedMotion = motionList[highlightedIndex];
      if (highlightedMotion) selectMotion(highlightedMotion);
    }
  };

  return (
    <div ref={wrapperRef} className="motion-dropdown">
      <button
        type="button"
        className={`motion-dropdown-trigger ${isOpen ? 'motion-dropdown-trigger--open' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="motion-dropdown-options"
        aria-activedescendant={isOpen && motionList.length > 0 ? optionId(highlightedIndex) : undefined}
      >
        <span className="motion-dropdown-trigger-content">
          <span className={`motion-dropdown-value ${selectedMotion ? '' : 'motion-dropdown-value--placeholder'}`}>
            {selectedMotion
              ? selectedMotion.name
              : loading
                ? 'Carregando comandos...'
                : motionList.length === 0
                  ? 'Nenhum comando salvo'
                  : 'Selecione um comando'}
          </span>
          {selectedMotion && (
            <span className="motion-dropdown-meta">{formatMotionMeta(selectedMotion)}</span>
          )}
        </span>
        <IconChevronDown className="motion-dropdown-chevron" size={17} aria-hidden="true" />
      </button>

      {isOpen && motionList.length > 0 && menuStyle && createPortal(
        <div
          ref={menuRef}
          id="motion-dropdown-options"
          className="motion-dropdown-menu"
          style={menuStyle}
          role="listbox"
          aria-label="Comandos salvos"
        >
          {motionList.map((motion, index) => (
            <div
              id={optionId(index)}
              key={motion.id}
              className={`motion-dropdown-option ${motion.id === value ? 'motion-dropdown-option--selected' : ''} ${index === highlightedIndex ? 'motion-dropdown-option--highlighted' : ''}`}
              role="option"
              aria-selected={motion.id === value}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectMotion(motion)}
            >
              <span className="motion-dropdown-option-name">{motion.name}</span>
              <span className="motion-dropdown-option-meta">{formatMotionMeta(motion)}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
