import React, { useState } from "react";
import styles from "../../styles/style.module.css";

const radiusOptions = [
  { value: 10, label: "10 miles" },
  { value: 25, label: "25 miles" },
  { value: 50, label: "50 miles" },
  { value: 100, label: "100 miles" },
  { value: "any", label: "Any distance" },
];

const premiumOptions = [
  { value: "all", label: "All locations" },
  { value: "premium", label: "Premium only" },
];

const SearchPanel = ({
  onSearch,
  onLocationRequest,
  isLoading,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchAddress, setSearchAddress] = useState("");
  const [searchRadius, setSearchRadius] = useState(50);
  const [premiumFilter, setPremiumFilter] = useState("all");

  const handleSubmit = async (e) => {
    e.preventDefault();
    onSearch({
      address: searchAddress,
      radius: searchRadius,
      filter: premiumFilter,
    });
  };

  return (
    <div
      className={`${styles.searchPanel} ${isCollapsed ? styles.collapsed : ""}`}
    >
      <button onClick={onToggleCollapse} className={styles.toggleButton}>
        {isCollapsed ? "Expand Search" : "Collapse Search"}
      </button>

      {!isCollapsed && (
        <form onSubmit={handleSubmit} className={styles.searchForm}>
          <div className={styles.searchInputGroup}>
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Enter address or location"
              className={styles.searchInput}
            />
            <button
              type="button"
              onClick={onLocationRequest}
              className={styles.locationButton}
              title="Find my location"
              disabled={isLoading}
            >
              <svg className={styles.locationIcon} viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </button>
          </div>

          <div className={styles.filterGroup}>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              className={styles.searchSelect}
              disabled={isLoading}
            >
              {radiusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={premiumFilter}
              onChange={(e) => setPremiumFilter(e.target.value)}
              className={styles.searchSelect}
              disabled={isLoading}
            >
              {premiumOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className={styles.searchButton}
              disabled={isLoading}
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SearchPanel;
