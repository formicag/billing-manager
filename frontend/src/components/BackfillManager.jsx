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
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudDownload as CloudDownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';

const BackfillManager = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    loadData();
    // Poll for job updates every 5 seconds
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [servicesData, jobsData] = await Promise.all([
        apiService.getServices(),
        apiService.getBackfillJobs(),
      ]);
      setServices(servicesData.filter(s => s.enabled));
      setJobs(jobsData);
    } catch (err) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const jobsData = await apiService.getBackfillJobs();
      setJobs(jobsData);
    } catch (err) {
      // Silently fail on polling errors
      console.error('Failed to refresh jobs:', err);
    }
  };

  const handleCreateBackfill = async () => {
    if (!selectedService || !startDate || !endDate) {
      toast.error('Please fill in all fields');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      toast.error('Start date must be before end date');
      return;
    }

    if (end > new Date()) {
      toast.error('End date cannot be in the future');
      return;
    }

    setCreating(true);
    try {
      await apiService.createBackfillJob(selectedService, startDate, endDate);
      toast.success('Backfill job created successfully');
      setSelectedService('');
      setStartDate('');
      setEndDate('');
      loadJobs();
    } catch (err) {
      toast.error('Failed to create backfill job: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;

    try {
      await apiService.deleteBackfillJob(selectedJob.id);
      toast.success('Backfill job deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedJob(null);
      loadJobs();
    } catch (err) {
      toast.error('Failed to delete job: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'primary';
      case 'pending':
        return 'warning';
      default:
        return 'default';
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getProgress = (job) => {
    if (job.status === 'completed') return 100;
    if (job.status === 'failed') return 0;
    if (job.progress) return job.progress;
    return 0;
  };

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

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
            Backfill Manager
          </Typography>
          <Button
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={loadJobs}
          >
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Create Backfill Form */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Create New Backfill Job
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                  Import historical cost data for a specific date range.
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Service</InputLabel>
                      <Select
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                        label="Service"
                      >
                        {services.map((service) => (
                          <MenuItem key={service.id} value={service.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <span>{getServiceIcon(service.id)}</span>
                              {service.name || service.id.toUpperCase()}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Start Date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="End Date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={creating ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
                      onClick={handleCreateBackfill}
                      disabled={creating || !selectedService || !startDate || !endDate}
                      sx={{ height: '56px' }}
                    >
                      Start Backfill
                    </Button>
                  </Grid>
                </Grid>

                {services.length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No enabled services available. Please configure and enable services in Credentials first.
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Jobs List */}
            <Typography variant="h6" gutterBottom>
              Backfill Jobs
            </Typography>

            {jobs.length === 0 ? (
              <Alert severity="info">
                No backfill jobs yet. Create one above to import historical cost data.
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell>Date Range</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Progress</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Completed</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{getServiceIcon(job.serviceId)}</span>
                            <Typography variant="body2">
                              {services.find(s => s.id === job.serviceId)?.name || job.serviceId.toUpperCase()}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(job.startDate)} - {formatDate(job.endDate)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={job.status.toUpperCase()}
                            color={getStatusColor(job.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ width: '100%', minWidth: 150 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 35 }}>
                                {getProgress(job)}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={getProgress(job)}
                              color={getStatusColor(job.status)}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDateTime(job.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {job.completedAt ? formatDateTime(job.completedAt) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSelectedJob(job);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={job.status === 'running'}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {jobs.some(job => job.status === 'running') && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Backfill jobs are running in the background. This page will update automatically.
              </Alert>
            )}
          </>
        )}
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Backfill Job</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this backfill job? This will not delete the imported cost data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteJob} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackfillManager;
