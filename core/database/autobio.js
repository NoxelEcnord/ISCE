const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const AutoBioDB = database.define('autobio', {
    status: {
        type: DataTypes.ENUM('on', 'off'),
        defaultValue: 'on',
        allowNull: false
    },
    message: {
        type: DataTypes.STRING,
        defaultValue: 'ISCE-BOT Always active!',
        allowNull: false
    }
}, {
    timestamps: true
});

async function initAutoBioDB() {
    try {
        await AutoBioDB.sync({ alter: true });
        console.log('AutoBio table ready');
    } catch (error) {
        console.error('Error initializing AutoBio table:', error);
        throw error;
    }
}

async function getAutoBioSettings() {
    try {
        let settings = await AutoBioDB.findOne();
        
        // If no record exists, create one using env vars as initial defaults
        if (!settings) {
            const envStatus = process.env.AUTO_BIO;
            const envMessage = process.env.AUTO_BIO_MSG;
            
            const initialStatus = envStatus !== undefined 
                ? ((envStatus.toLowerCase() === 'on' || envStatus.toLowerCase() === 'true') ? 'on' : 'off') 
                : 'on';
            
            settings = await AutoBioDB.create({
                status: initialStatus,
                message: envMessage || 'ISCE-BOT Always active!'
            });
        }
        
        // Database values take priority (commands override env vars)
        return {
            status: settings.status || 'on',
            message: settings.message || 'ISCE-BOT Always active!'
        };
    } catch (error) {
        console.error('Error getting AutoBio settings:', error);
        const envStatus = process.env.AUTO_BIO;
        const envMessage = process.env.AUTO_BIO_MSG;
        return { 
            status: envStatus ? ((envStatus.toLowerCase() === 'on' || envStatus.toLowerCase() === 'true') ? 'on' : 'off') : 'off', 
            message: envMessage || 'ISCE-BOT Always active!' 
        };
    }
}

// Sync settings from Heroku env vars
async function syncAutoBioFromEnv() {
    try {
        const envStatus = process.env.AUTO_BIO;
        const envMessage = process.env.AUTO_BIO_MSG;
        
        const status = envStatus !== undefined 
            ? ((envStatus.toLowerCase() === 'on' || envStatus.toLowerCase() === 'true') ? 'on' : 'off') 
            : 'on';
        const message = envMessage || 'ISCE-BOT Always active!';
        
        let settings = await AutoBioDB.findOne();
        if (!settings) {
            settings = await AutoBioDB.create({ status, message });
        } else {
            await settings.update({ status, message });
        }
        return { status, message };
    } catch (error) {
        console.error('Error syncing autobio from env:', error);
        return null;
    }
}

async function updateAutoBioSettings(updates) {
    try {
        let settings = await AutoBioDB.findOne();
        if (!settings) {
            settings = await AutoBioDB.create({});
        }
        return await settings.update(updates);
    } catch (error) {
        console.error('Error updating AutoBio settings:', error);
        return null;
    }
}

module.exports = {
    initAutoBioDB,
    getAutoBioSettings,
    updateAutoBioSettings,
    syncAutoBioFromEnv,
    AutoBioDB
};
