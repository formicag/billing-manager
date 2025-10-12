import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Toolbar,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';

const FREQUENCY_OPTIONS = [
  { value: 'hourly', label: 'Hourly', description: 'Collect costs every hour' },
  { value: 'daily', label: 'Daily', description: 'Collect costs once per day at midnight UTC' },
  { value: 'weekly', label: 'Weekly', description: 'Collect costs once per week on Sunday at midnight UTC' },
];

const ScheduleManager = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [editData, setEditData] = useState({ enabled: false, frequency: 'daily' });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [servicesData, schedulesData] = await Promise.all([
        apiService.getServices(),
        apiService.getSchedules(),
      ]);
      setServices(servicesData);

      // Convert schedules array to object keyed by serviceId
      const schedMap = {};
      schedulesData.forEach(sched => {
        schedMap[sched.serviceId] = sched;
      });
      setSchedules(schedMap);
    } catch (err) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (serviceId, currentEnabled) => {
    try {
      const schedule = schedules[serviceId];
      if (!schedule) {
        // Create new schedule if it doesn't exist
        await apiService.updateSchedule(serviceId, {
          enabled: true,
          frequency: 'daily',
        });
        toast.success('Schedule enabled');
      } else {
        // Update existing schedule
        await apiService.updateSchedule(serviceId, {
          ...schedule,
          enabled: !currentEnabled,
        });
        toast.success(`Schedule ${!currentEnabled ? 'enabled' : 'disabled'}`);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to update schedule: ' + err.message);
    }
  };

  const handleOpenDialog = (serviceId) => {
    const schedule = schedules[serviceId];
    setSelectedService(serviceId);
    setEditData({
      enabled: schedule?.enabled || false,
      frequency: schedule?.frequency || 'daily',
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedService(null);
    setEditData({ enabled: false, frequency: 'daily' });
  };

  const handleSave = async () => {
    if (!selectedService) return;

    setSaving(true);
    try {
      await apiService.updateSchedule(selectedService, editData);
      toast.success('Schedule updated successfully');
      handleCloseDialog();
      loadData();
    } catch (err) {
      toast.error('Failed to update schedule: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async (serviceId) => {
    setRunning(prev => ({ ...prev, [serviceId]: true }));
    try {
      await apiService.runSchedule(serviceId);
      toast.success('Schedule triggered successfully');
    } catch (err) {
      toast.error('Failed to run schedule: ' + err.message);
    } finally {
      setRunning(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const getServiceIcon = (serviceId) => {
    const icons = {
      aws: '☁️',
      gcp: '🔵',
      atlassian: '🔷',
      'google-workspace': '📧',
      chatgpt: '🤖',
      cohere: '🧠',
    };
    return icons[serviceId] || '💰';
  };

  const getFrequencyInfo = (frequency) => {
    return FREQUENCY_OPTIONS.find(opt => opt.value === frequency) || FREQUENCY_OPTIONS[1];
  };

  const getNextRunTime = (schedule) => {
    if (!schedule || !schedule.enabled || !schedule.nextRun) {
      return 'N/A';
    }
    return new Date(schedule.nextRun).toLocaleString();
  };

  const getLastRunTime = (schedule) => {
    if (!schedule || !schedule.lastRun) {
      return 'Never';
    }
    return new Date(schedule.lastRun).toLocaleString();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="back"
            onClick={() => navigate('/')}
            edge="start"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Schedule Manager
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Configure automated cost collection schedules for each service.
              </Typography>
            </Box>

            {services.length === 0 ? (
              <Alert severity="info">
                No services configured. Add credentials first to set up schedules.
              </Alert>
            ) : (
              <Grid container spacing={3}>
                {services.map((service) => {
                  const schedule = schedules[service.id];
                  const isEnabled = schedule?.enabled || false;
                  const frequency = schedule?.frequency || 'daily';

                  return (
                    <Grid item xs={12} key={service.id}>
                      <Card>
                        <CardContent>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={3} md={2}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h4">
                                  {getServiceIcon(service.id)}
                                </Typography>
                                <Box>
                                  <Typography variant="h6">
                                    {service.name || service.id.toUpperCase()}
                                  </Typography>
                                  <Chip
                                    label={service.enabled ? 'Active' : 'Inactive'}
                                    size="small"
                                    color={service.enabled ? 'success' : 'default'}
                                  />
                                </Box>
                              </Box>
                            </Grid>

                            <Grid item xs={12} sm={3} md={2}>
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Schedule
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                  <Switch
                                    checked={isEnabled}
                                    onChange={() => handleToggleSchedule(service.id, isEnabled)}
                                    disabled={!service.enabled}
                                  />
                                  <Typography variant="body2">
                                    {isEnabled ? 'Enabled' : 'Disabled'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>

                            <Grid item xs={12} sm={3} md={2}>
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Frequency
                                </Typography>
                                <Typography variant="body1" sx={{ mt: 1 }}>
                                  <ScheduleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                                  {getFrequencyInfo(frequency).label}
                                </Typography>
                              </Box>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Last Run
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {getLastRunTime(schedule)}
                                </Typography>
                              </Box>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<EditIcon />}
                                  onClick={() => handleOpenDialog(service.id)}
                                  disabled={!service.enabled}
                                >
                                  Configure
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={
                                    running[service.id] ? (
                                      <CircularProgress size={16} color="inherit" />
                                    ) : (
                                      <PlayArrowIcon />
                                    )
                                  }
                                  onClick={() => handleRunNow(service.id)}
                                  disabled={!service.enabled || running[service.id]}
                                >
                                  Run Now
                                </Button>
                              </Box>
                            </Grid>
                          </Grid>

                          {isEnabled && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {getFrequencyInfo(frequency).description}
                              </Typography>
                              {schedule?.nextRun && (
                                <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                                  Next scheduled run: {getNextRunTime(schedule)}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </>
        )}
      </Container>

      {/* Edit Schedule Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Configure Schedule - {services.find(s => s.id === selectedService)?.name || selectedService}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={editData.enabled}
                  onChange={(e) => setEditData({ ...editData, enabled: e.target.checked })}
                />
              }
              label="Enable Schedule"
            />

            <FormControl fullWidth sx={{ mt: 3 }}>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={editData.frequency}
                onChange={(e) => setEditData({ ...editData, frequency: e.target.value })}
                label="Frequency"
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box>
                      <Typography variant="body1">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 3 }}>
              Schedules run automatically in the background. You can also trigger collection manually using the "Run Now" button.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleManager;
