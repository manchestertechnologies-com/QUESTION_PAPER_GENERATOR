import React, { createContext, useState, useContext } from 'react';
import Loader from '../components/Loader';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [requestCount, setRequestCount] = useState(0);

    const showLoader = () => {
        setIsLoading(true);
        setRequestCount(prev => prev + 1);
    };

    const hideLoader = () => {
        setRequestCount(prev => {
            const nextCount = Math.max(0, prev - 1);
            if (nextCount === 0) setIsLoading(false);
            return nextCount;
        });
    };

    return (
        <LoadingContext.Provider value={{ showLoader, hideLoader, isLoading }}>
            {/* 4-dot loader for every page load & action */}
            {isLoading && (
                <Loader fullPage={true} />
            )}
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);
