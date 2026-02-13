const { DataTypes } = require('sequelize');
const { database } = require('../../config');

// Target groups for the campaign
const CampaignGroupDB = database.define('campaign_groups', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    added_by: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'campaign_groups'
});

// Sticker flooding state
const CampaignStateDB = database.define('campaign_state', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    is_flooding: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sticker_count: {
        type: DataTypes.INTEGER, // 0 for infinite
        defaultValue: 0
    },
    interval_ms: {
        type: DataTypes.INTEGER, // 0 for flood
        defaultValue: 500
    },
    pack_id: {
        type: DataTypes.STRING,
        defaultValue: 'corazone'
    }
}, {
    timestamps: true,
    tableName: 'campaign_state'
});

async function initCampaignDB() {
    try {
        await CampaignGroupDB.sync({ alter: true });
        await CampaignStateDB.sync({ alter: true });
        console.log('Campaign tables ready');
    } catch (error) {
        console.error('Error initializing Campaign tables:', error);
    }
}

async function addCampaignGroup(jid, sender) {
    try {
        await CampaignGroupDB.findOrCreate({
            where: { jid },
            defaults: { added_by: sender }
        });
        return true;
    } catch (e) {
        console.error('Error adding campaign group:', e);
        return false;
    }
}

async function removeCampaignGroup(jid) {
    try {
        await CampaignGroupDB.destroy({ where: { jid } });
        return true;
    } catch (e) {
        console.error('Error removing campaign group:', e);
        return false;
    }
}

async function getCampaignGroups() {
    try {
        const groups = await CampaignGroupDB.findAll();
        return groups.map(g => g.jid);
    } catch (e) {
        console.error('Error getting campaign groups:', e);
        return [];
    }
}

async function updateCampaignState(updates) {
    try {
        let state = await CampaignStateDB.findOne();
        if (!state) {
            state = await CampaignStateDB.create(updates);
        } else {
            await state.update(updates);
        }
        return state;
    } catch (e) {
        console.error('Error updating campaign state:', e);
        return null;
    }
}

async function getCampaignState() {
    try {
        let state = await CampaignStateDB.findOne();
        if (!state) {
            state = await CampaignStateDB.create({});
        }
        return state;
    } catch (e) {
        console.error('Error getting campaign state:', e);
        return { is_flooding: false, sticker_count: 0, interval_ms: 5000 };
    }
}

module.exports = {
    initCampaignDB,
    addCampaignGroup,
    removeCampaignGroup,
    getCampaignGroups,
    updateCampaignState,
    getCampaignState,
    CampaignGroupDB,
    CampaignStateDB
};
