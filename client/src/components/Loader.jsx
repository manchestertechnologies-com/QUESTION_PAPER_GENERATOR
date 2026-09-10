import React from 'react';
import FourDotLoader from './FourDotLoader';

const Loader = ({ fullPage = false, text = '', size = 'md', className = '' }) => {
    return <FourDotLoader fullPage={fullPage} text={text} size={size} className={className} />;
};

export default Loader;

