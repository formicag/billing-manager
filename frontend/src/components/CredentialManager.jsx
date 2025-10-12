import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Toolbar,
  Typography,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Check as CheckIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';

const SUPPORTED_SERVICES = [
  { id: 'aws', name: 'Amazon Web Services (AWS)', icon: '☁️' },
  { id: 'gcp', name: 'Google Cloud Platform (GCP)', icon: '🔵' },
  { id: 'atlassian', name: 'Atlassian', icon: '🔷' },
  { id: 'google-workspace', name: 'Google Workspace', icon: '📧' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖' },
  { id: 'cohere', name: 'Cohere', icon: '🧠' },
];

const CREDENTIAL_FIELDS = {
  aws: [
    { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'region', label: 'Region', type: 'text', required: true, default: 'us-east-1' },
  ],
  gcp: [
    { key: 'projectId', label: 'Project ID', type: 'text', required: true },
    { key: 'clientEmail', label: 'Client Email', type: 'text', required: true },
    { key: 'privateKey', label: 'Private Key', type: 'textarea', required: true },
  ],
  atlassian: [
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'apiToken', label: 'API Token', type: 'password', required: true },
    { key: 'orgId', label: 'Organization ID', type: 'text', required: true },
  ],
  'google-workspace': [
    { key: 'adminEmail', label: 'Admin Email', type: 'text', required: true },
    { key: 'customerId', label: 'Customer ID', type: 'text', required: true },
    { key: 'privateKey', label: 'Private Key', type: 'textarea', required: true },
  ],
  chatgpt: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'organizationId', label: 'Organization ID', type: 'text', required: false },
  ],
  cohere: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
};

const CredentialManager = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [credentials, setCredentials] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [formData, setFormData] = useState({});
  const [revealedData, setRevealedData] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [servicesData, credentialsData] = await Promise.all([
        apiService.getServices(),
        apiService.getCredentials(),
      ]);
      // Extract services array from response
      setServices(Array.isArray(servicesData) ? servicesData : (servicesData.services || []));

      // Convert credentials array to object keyed by serviceId
      const credMap = {};
      const credArray = Array.isArray(credentialsData) ? credentialsData : (credentialsData.credentials || []);
      credArray.forEach(cred => {
        credMap[cred.serviceId] = cred;
      });
      setCredentials(credMap);
    } catch (err) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = async (serviceId = null) => {
    setSelectedService(serviceId);

    if (serviceId && credentials[serviceId]) {
      // Editing existing credential - load actual values
      try {
        const response = await apiService.revealCredential(serviceId);
        const actualCredentials = response.credentials || response;
        setFormData(actualCredentials);
      } catch (err) {
        // If reveal fails, use empty form
        toast.error('Failed to load credentials: ' + err.message);
        const fields = CREDENTIAL_FIELDS[serviceId] || [];
        const initialData = {};
        fields.forEach(field => {
          initialData[field.key] = '';
        });
        setFormData(initialData);
      }
    } else {
      // Adding new credential - initialize with defaults
      const fields = CREDENTIAL_FIELDS[serviceId] || [];
      const initialData = {};
      fields.forEach(field => {
        initialData[field.key] = field.default || '';
      });
      setFormData(initialData);
    }
    setShowPassword({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedService(null);
    setFormData({});
    setShowPassword({});
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTest = async () => {
    if (!selectedService) return;

    setTesting(true);
    try {
      await apiService.testCredential(selectedService, formData);
      toast.success('Credentials are valid!');
    } catch (err) {
      toast.error('Credential test failed: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedService) return;

    setSaving(true);
    try {
      await apiService.saveCredential(selectedService, formData, selectedService);
      toast.success('Credentials saved successfully');
      handleCloseDialog();
      loadData();
    } catch (err) {
      toast.error('Failed to save credentials: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedService) return;

    try {
      await apiService.deleteCredential(selectedService);
      toast.success('Credentials deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedService(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete credentials: ' + err.message);
    }
  };

  const handleReveal = async (serviceId) => {
    setSelectedService(serviceId);
    try {
      const response = await apiService.revealCredential(serviceId);
      // Extract credentials from response
      setRevealedData(response.credentials || response);
      setRevealDialogOpen(true);
    } catch (err) {
      toast.error('Failed to reveal credentials: ' + err.message);
    }
  };

  const togglePasswordVisibility = (key) => {
    setShowPassword(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getServiceInfo = (serviceId) => {
    return SUPPORTED_SERVICES.find(s => s.id === serviceId) || { name: serviceId, icon: '💰' };
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
            Credential Manager
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
                Manage API credentials for cloud services and billing platforms.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {SUPPORTED_SERVICES.map((service) => {
                const hasCredential = credentials[service.id];
                const isEnabled = services.find(s => s.id === service.id)?.enabled;

                return (
                  <Grid item xs={12} sm={6} md={4} key={service.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h4" sx={{ mr: 1 }}>
                            {service.icon}
                          </Typography>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">
                              {service.name}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                          <Chip
                            label={hasCredential ? 'Configured' : 'Not Configured'}
                            color={hasCredential ? 'success' : 'default'}
                            size="small"
                            icon={hasCredential ? <CheckIcon /> : undefined}
                          />
                          {hasCredential && (
                            <Chip
                              label={isEnabled ? 'Enabled' : 'Disabled'}
                              color={isEnabled ? 'primary' : 'default'}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>

                        {hasCredential && (
                          <Typography variant="body2" color="text.secondary">
                            Last updated: {new Date(credentials[service.id].updatedAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions>
                        {hasCredential ? (
                          <>
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => handleOpenDialog(service.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              startIcon={<VisibilityIcon />}
                              onClick={() => handleReveal(service.id)}
                            >
                              Reveal
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => {
                                setSelectedService(service.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            variant="contained"
                            onClick={() => handleOpenDialog(service.id)}
                          >
                            Add Credentials
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )}
      </Container>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {credentials[selectedService] ? 'Edit' : 'Add'} Credentials - {getServiceInfo(selectedService).name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedService && CREDENTIAL_FIELDS[selectedService]?.map((field) => (
              <TextField
                key={field.key}
                fullWidth
                margin="normal"
                label={field.label}
                required={field.required}
                type={
                  field.type === 'password' && !showPassword[field.key]
                    ? 'password'
                    : field.type === 'textarea'
                    ? 'text'
                    : field.type
                }
                multiline={field.type === 'textarea'}
                rows={field.type === 'textarea' ? 4 : 1}
                value={formData[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                InputProps={
                  field.type === 'password'
                    ? {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => togglePasswordVisibility(field.key)}
                              edge="end"
                            >
                              {showPassword[field.key] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }
                    : undefined
                }
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleTest}
            disabled={testing || saving}
            startIcon={testing ? <CircularProgress size={16} /> : <PlayArrowIcon />}
          >
            Test
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={testing || saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Credentials</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete credentials for {getServiceInfo(selectedService).name}?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reveal Dialog */}
      <Dialog
        open={revealDialogOpen}
        onClose={() => {
          setRevealDialogOpen(false);
          setRevealedData(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Revealed Credentials - {getServiceInfo(selectedService).name}</DialogTitle>
        <DialogContent>
          {revealedData && (
            <Box sx={{ pt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Keep these credentials secure. Do not share them.
              </Alert>
              {Object.entries(revealedData).map(([key, value]) => (
                <TextField
                  key={key}
                  fullWidth
                  margin="normal"
                  label={key}
                  value={value}
                  InputProps={{
                    readOnly: true,
                  }}
                  multiline
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRevealDialogOpen(false);
              setRevealedData(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CredentialManager;
