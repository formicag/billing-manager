import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Card,
  CardContent,
  Container,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  VpnKey as VpnKeyIcon,
  Schedule as ScheduleIcon,
  CloudDownload as CloudDownloadIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Credentials', icon: <VpnKeyIcon />, path: '/credentials' },
    { text: 'Schedules', icon: <ScheduleIcon />, path: '/schedules' },
    { text: 'Backfill', icon: <CloudDownloadIcon />, path: '/backfill' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [servicesData, summaryData] = await Promise.all([
        apiService.getServices(),
        apiService.getCostSummary(),
      ]);
      setServices(servicesData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load dashboard data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const enabledServices = services.filter(s => s.enabled);
      if (enabledServices.length === 0) {
        toast.warning('No enabled services to refresh');
        return;
      }

      const results = await Promise.allSettled(
        enabledServices.map(service =>
          apiService.triggerCostCollection(service.id)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed === 0) {
        toast.success(`Successfully triggered cost collection for ${successful} service(s)`);
      } else {
        toast.warning(`Triggered ${successful} service(s), ${failed} failed`);
      }

      // Reload data after a short delay
      setTimeout(() => loadDashboardData(), 2000);
    } catch (err) {
      toast.error('Failed to refresh costs: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleServiceClick = (serviceId) => {
    navigate(`/service/${serviceId}`);
  };

  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={toggleDrawer(true)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Billing Manager
          </Typography>
          <Button
            color="inherit"
            startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
            onClick={handleRefreshAll}
            disabled={refreshing || loading}
          >
            Refresh All
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        <Box
          sx={{ width: 250 }}
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton onClick={() => navigate(item.path)}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            {/* Summary Statistics */}
            {summary && (
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Total Services
                      </Typography>
                      <Typography variant="h4">
                        {services.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Active Services
                      </Typography>
                      <Typography variant="h4">
                        {services.filter(s => s.enabled).length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Total Cost (MTD)
                      </Typography>
                      <Typography variant="h4">
                        {formatCurrency(summary.totalCost || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Last Updated
                      </Typography>
                      <Typography variant="h6" sx={{ mt: 1 }}>
                        {summary.lastUpdated
                          ? new Date(summary.lastUpdated).toLocaleString()
                          : 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Service Cards */}
            <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
              Services
            </Typography>
            {services.length === 0 ? (
              <Alert severity="info">
                No services configured. Go to Credentials to add services.
              </Alert>
            ) : (
              <Grid container spacing={3}>
                {services.map((service) => (
                  <Grid item xs={12} sm={6} md={4} key={service.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                      onClick={() => handleServiceClick(service.id)}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h3">
                              {getServiceIcon(service.id)}
                            </Typography>
                            <Typography variant="h6">
                              {service.name || service.id.toUpperCase()}
                            </Typography>
                          </Box>
                          <Chip
                            label={service.enabled ? 'Active' : 'Inactive'}
                            color={service.enabled ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Current Cost
                          </Typography>
                          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {formatCurrency(service.currentCost || 0)}
                            <TrendingUpIcon fontSize="small" color="primary" />
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Last Updated: {service.lastUpdated
                              ? new Date(service.lastUpdated).toLocaleDateString()
                              : 'Never'}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
